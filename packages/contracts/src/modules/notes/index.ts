import { z } from "zod";
import { idSchema, operationSchema, versionSchema } from "../../platform/core";
import { listColorSchema } from "../../platform/design";
export const noteModes = ["note", "moodboard"] as const;
export const noteRoleSchema = z.enum(["viewer", "editor"]);
export type NoteRole = z.infer<typeof noteRoleSchema>;
export const noteContentLimit = 16_000;
export const noteTagsSchema = z.array(z.string().trim().min(1).max(40)).max(20).transform(values => [...new Set(values.map(v => v.toLocaleLowerCase("en-US")))].sort());
export const noteUrlSchema = z.url().max(2048).refine(value => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !/[\u0000-\u0020\u007f]/.test(value);
}, "Use an HTTP or HTTPS address without credentials");
export const boardBodySchema = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("text"),title:z.string().trim().max(160).default(""),text:z.string().max(8000)}).strict(),
  z.object({kind:z.literal("image"),assetId:idSchema,caption:z.string().max(300).default("")}).strict(),
  z.object({kind:z.literal("link"),url:noteUrlSchema,title:z.string().trim().min(1).max(160)}).strict(),
  z.object({kind:z.literal("note"),targetId:idSchema}).strict(),
]);
export type BoardBody = z.infer<typeof boardBodySchema>;
export const noteFieldsSchema = z.object({
  title:z.string().trim().min(1).max(300),content:z.string().max(noteContentLimit).default(""),
  tags:noteTagsSchema.default([]),mode:z.enum(noteModes).default("note"),theme:listColorSchema.default("blue"),
}).strict();
export type NoteFields = z.infer<typeof noteFieldsSchema>;
export const createNoteSchema = operationSchema.extend(noteFieldsSchema.shape).strict();
export const noteQuerySchema = z.object({
  search:z.string().trim().max(200).default(""),tag:z.string().trim().max(40).optional(),
  filter:z.enum(["all","pinned","archived","shared","trash"]).default("all"),
  limit:z.number().int().min(1).max(100).default(50),offset:z.number().int().min(0).max(5000).default(0),
}).strict();
export const noteMutationSchema = operationSchema.extend({
  noteId:idSchema,version:versionSchema,
  change:z.discriminatedUnion("action",[
    noteFieldsSchema.extend({action:z.literal("save")}).strict(),
    z.object({action:z.literal("preference"),preferenceVersion:versionSchema,pinned:z.boolean(),archived:z.boolean()}).strict(),
    z.object({action:z.literal("share"),email:z.email().max(254).transform(v=>v.toLowerCase()),role:noteRoleSchema}).strict(),
    z.object({action:z.literal("unshare"),userId:z.string().min(1).max(200)}).strict(),
    z.object({action:z.literal("leave")}).strict(),
    z.object({action:z.literal("trash")}).strict(),
    z.object({action:z.literal("restore")}).strict(),
    z.object({action:z.literal("link"),targetId:idSchema}).strict(),
    z.object({action:z.literal("unlink"),targetId:idSchema}).strict(),
    z.object({action:z.literal("add_card"),body:boardBodySchema}).strict(),
    z.object({action:z.literal("update_card"),cardId:idSchema,body:boardBodySchema}).strict(),
    z.object({action:z.literal("remove_card"),cardId:idSchema}).strict(),
    z.object({action:z.literal("reorder_cards"),cardIds:z.array(idSchema).max(100).refine(v=>new Set(v).size===v.length,"Include each card once")}).strict(),
  ]),
}).strict();
export type NoteMutation = z.infer<typeof noteMutationSchema>;
export const noteImageSchema = operationSchema.extend({noteId:idSchema,version:versionSchema,imageBase64:z.string().min(4).max(4*Math.ceil(3*1024*1024/3))}).strict();
export const noteTaskSchema = operationSchema.extend({noteId:idSchema,version:versionSchema,listId:idSchema,listVersion:versionSchema,title:z.string().trim().min(1).max(300),includeContent:z.boolean().default(false),confirmed:z.literal(true)}).strict();
export const notesSettingsSchema = z.object({defaultMode:z.enum(noteModes).default("note"),defaultTheme:listColorSchema.default("blue"),dashboard:z.enum(["pinned","recent"]).default("pinned"),dashboardLimit:z.number().int().min(1).max(8).default(4)}).strict();
export type NotesSettings = {userId:string;version:number;settings:z.infer<typeof notesSettingsSchema>};
export const updateNotesSettingsSchema = operationSchema.extend({version:versionSchema,settings:notesSettingsSchema}).strict();
export type NoteSummary = NoteFields & {id:string;ownerId:string;ownerName:string;version:number;role:"owner"|NoteRole;shared:boolean;pinned:boolean;archived:boolean;preferenceVersion:number;trashed:boolean;updatedAt:string};
export type NoteReference = {id:string;title:string;mode:"note"|"moodboard";path:string};
export type NoteCard = {id:string;position:number;body:BoardBody|{kind:"note";unavailable:true};target?:NoteReference;imagePath?:string};
export type NoteDetail = NoteSummary & {userId:string;canEdit:boolean;canManage:boolean;links:NoteReference[];backlinks:NoteReference[];cards:NoteCard[];assets:{id:string;path:string;width:number;height:number;ready:boolean}[];members?:{userId:string;name:string;email:string;role:NoteRole}[];tasks:{id:string;title:string;path:string}[]};
export type NotesResult = {userId:string;notes:NoteSummary[];total:number;tags:string[]};
export type NotesDashboard = {userId:string;notes:Pick<NoteSummary,"id"|"title"|"mode"|"theme"|"pinned"|"updatedAt">[]};
export const notePath = (id:string) => `/notes?note=${idSchema.parse(id)}`;
export const noteImagePath = (id:string) => `/api/v1/notes/images/${idSchema.parse(id)}`;
export function noteExcerpt(content:string, limit=180) {return content.replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/[#*_`>\[\]]/g,"").replace(/\s+/g," ").trim().slice(0,limit)}
export function noteTaskContent(noteId:string, content:string, includeContent:boolean, origin:string) {
  const url=new URL(notePath(noteId),origin);
  const link=`[Source note](${url.href})`;
  const text=includeContent?content.replace(/!\[[^\]]*\]\([^)]*\)/g,"").slice(0,noteContentLimit-link.length-2):"";
  return text?`${text}\n\n${link}`:link;
}
