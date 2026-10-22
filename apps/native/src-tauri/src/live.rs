use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::{collections::HashMap, sync::Arc, time::Duration};
use tauri::{ipc::Channel, State};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::{
    connect_async_with_config,
    tungstenite::{client::IntoClientRequest, protocol::WebSocketConfig, Message},
};

const PRODUCTION: &str =
    "wss://br-twilight-glitter-b9dbgk2g-neonrealtimesocket.compute.c-7.eu-central-1.aws.neon.tech";
const DEVELOPMENT: &str =
    "wss://br-plain-field-b9ubcjv4-neonrealtimesocket.compute.c-7.eu-central-1.aws.neon.tech";
#[derive(Default, Clone)]
pub struct LiveSockets(Arc<Mutex<HashMap<String, mpsc::Sender<String>>>>);
#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "lowercase")]
pub enum SocketEvent {
    Open,
    Text(String),
    Close,
    Error,
}
fn allowed(url: &str) -> bool {
    url == PRODUCTION
        || url == format!("{PRODUCTION}/")
        || (cfg!(debug_assertions) && (url == DEVELOPMENT || url == format!("{DEVELOPMENT}/")))
}
#[tauri::command]
pub async fn live_open(
    id: String,
    url: String,
    events: Channel<SocketEvent>,
    state: State<'_, LiveSockets>,
) -> Result<(), &'static str> {
    if !allowed(&url) || id.len() != 36 {
        return Err("Live connection is not allowed");
    }
    let (tx, mut rx) = mpsc::channel::<String>(32);
    let sockets = state.inner().clone();
    {
        let mut map = sockets.0.lock().await;
        if map.len() >= 4 || map.contains_key(&id) {
            return Err("Too many live connections");
        }
        map.insert(id.clone(), tx);
    }
    tauri::async_runtime::spawn(async move {
        let result: Result<(), ()> = async {
        let mut request=url.into_client_request().map_err(|_| ())?;
        request.headers_mut().insert("Sec-WebSocket-Protocol", "neon.realtime.v1".parse().map_err(|_| ())?);
        let config=WebSocketConfig::default().max_message_size(Some(4 * 1024 * 1024)).max_frame_size(Some(4 * 1024 * 1024));
        // Native TLS transport sends no browser Origin. Authorization is still
        // the short-lived server-sealed capability, never a database secret.
        let (mut socket,_) = tokio::select! {
          result=tokio::time::timeout(Duration::from_secs(20),connect_async_with_config(request,Some(config),false)) => result.map_err(|_| ())?.map_err(|_| ())?,
          _=rx.recv()=> return Ok(()),
        };
        events.send(SocketEvent::Open).map_err(|_| ())?;
        loop {
          tokio::select! {
            outgoing=rx.recv()=> match outgoing {
              Some(text)=> tokio::time::timeout(Duration::from_secs(10),socket.send(Message::Text(text.into()))).await.map_err(|_| ())?.map_err(|_| ())?,
              None=> { let _=tokio::time::timeout(Duration::from_secs(2),socket.close(None)).await; break; }
            },
            incoming=socket.next()=>match incoming {
              Some(Ok(Message::Text(text)))=>events.send(SocketEvent::Text(text.to_string())).map_err(|_| ())?,
              Some(Ok(Message::Ping(_)))=>tokio::time::timeout(Duration::from_secs(10),socket.flush()).await.map_err(|_| ())?.map_err(|_| ())?,
              Some(Ok(Message::Pong(_)))=>{},
              Some(Ok(Message::Close(_)))|None=>break,
              _=>return Err(()),
            }
          }
        }
        Ok(())
      }.await;
        sockets.0.lock().await.remove(&id);
        if result.is_err() {
            let _ = events.send(SocketEvent::Error);
        }
        let _ = events.send(SocketEvent::Close);
    });
    Ok(())
}
#[tauri::command]
pub async fn live_send(
    id: String,
    text: String,
    state: State<'_, LiveSockets>,
) -> Result<(), &'static str> {
    if text.len() > 131_072 {
        return Err("Live frame too large");
    }
    let map = state.0.lock().await;
    map.get(&id)
        .ok_or("Live connection is closed")?
        .try_send(text)
        .map_err(|_| "Live connection is busy")
}
#[tauri::command]
pub async fn live_close(id: String, state: State<'_, LiveSockets>) -> Result<(), &'static str> {
    state.0.lock().await.remove(&id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn transport_only_accepts_exact_realtime_endpoints() {
        assert!(allowed(PRODUCTION));
        assert!(allowed(&format!("{PRODUCTION}/")));
        for url in [
            "ws://localhost:3000",
            "wss://evil.example",
            &format!("{PRODUCTION}.evil.example"),
            &format!("{PRODUCTION}/other"),
            &format!("{PRODUCTION}?token=secret"),
        ] {
            assert!(!allowed(url));
        }
    }
}
