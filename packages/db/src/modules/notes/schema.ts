import {pgTable,uuid,text,integer,boolean,timestamp,jsonb,primaryKey,index,uniqueIndex} from "drizzle-orm/pg-core";
import {users} from "../../platform/schema";
import {tasks} from "../todo/schema";
import type {BoardBody,NotesSettings} from "@wuff/contracts";
const time=(name:string)=>timestamp(name,{withTimezone:true}).notNull().defaultNow();
export const notes=pgTable("wuff_notes",{
 id:uuid("id").primaryKey().defaultRandom(),ownerId:text("owner_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
 title:text("title").notNull(),content:text("content").notNull().default(""),tags:jsonb("tags").$type<string[]>().notNull().default([]),
 mode:text("mode").$type<"note"|"moodboard">().notNull().default("note"),theme:text("theme").$type<import("@wuff/contracts").ListColor>().notNull().default("blue"),version:integer("version").notNull().default(0),
 deletedAt:timestamp("deleted_at",{withTimezone:true}),createdAt:time("created_at"),updatedAt:time("updated_at"),
},t=>[index("wuff_notes_owner_updated_idx").on(t.ownerId,t.updatedAt)]);
export const noteMembers=pgTable("wuff_note_members",{
 noteId:uuid("note_id").notNull().references(()=>notes.id,{onDelete:"cascade"}),userId:text("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),role:text("role").$type<"viewer"|"editor">().notNull(),createdAt:time("created_at"),
},t=>[primaryKey({columns:[t.noteId,t.userId]}),index("wuff_note_members_user_idx").on(t.userId)]);
export const notePreferences=pgTable("wuff_note_preferences",{
 noteId:uuid("note_id").notNull().references(()=>notes.id,{onDelete:"cascade"}),userId:text("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),version:integer("version").notNull().default(0),pinned:boolean("pinned").notNull().default(false),archived:boolean("archived").notNull().default(false),
},t=>[primaryKey({columns:[t.noteId,t.userId]})]);
export const noteLinks=pgTable("wuff_note_links",{
 sourceId:uuid("source_id").notNull().references(()=>notes.id,{onDelete:"cascade"}),targetId:uuid("target_id").notNull().references(()=>notes.id,{onDelete:"cascade"}),
},t=>[primaryKey({columns:[t.sourceId,t.targetId]}),index("wuff_note_links_target_idx").on(t.targetId)]);
export const noteCards=pgTable("wuff_note_cards",{
 id:uuid("id").primaryKey().defaultRandom(),noteId:uuid("note_id").notNull().references(()=>notes.id,{onDelete:"cascade"}),position:integer("position").notNull(),body:jsonb("body").$type<BoardBody>().notNull(),
},t=>[index("wuff_note_cards_note_idx").on(t.noteId)]);
export const noteAssets=pgTable("wuff_note_assets",{
 id:uuid("id").primaryKey(),noteId:uuid("note_id").notNull().references(()=>notes.id,{onDelete:"cascade"}),operationId:uuid("operation_id").notNull(),uploaderId:text("uploader_id").notNull().references(()=>users.id),pathname:text("pathname").notNull(),digest:text("digest").notNull(),width:integer("width").notNull(),height:integer("height").notNull(),bytes:integer("bytes").notNull(),ready:boolean("ready").notNull().default(false),createdAt:time("created_at"),
},t=>[uniqueIndex("wuff_note_assets_operation_idx").on(t.uploaderId,t.operationId),index("wuff_note_assets_note_idx").on(t.noteId)]);
export const notesSettings=pgTable("wuff_notes_settings",{
 userId:text("user_id").primaryKey().references(()=>users.id,{onDelete:"cascade"}),version:integer("version").notNull().default(0),settings:jsonb("settings").$type<NotesSettings["settings"]>().notNull(),
});
export const noteTasks=pgTable("wuff_note_tasks",{
 noteId:uuid("note_id").notNull().references(()=>notes.id,{onDelete:"cascade"}),taskId:uuid("task_id").notNull().references(()=>tasks.id,{onDelete:"cascade"}),creatorId:text("creator_id").notNull().references(()=>users.id),
},t=>[primaryKey({columns:[t.noteId,t.taskId]})]);
