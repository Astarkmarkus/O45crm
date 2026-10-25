import { createClient } from "npm:@supabase/supabase-js@2";
const cors={ "Access-Control-Allow-Origin":"https://astarkmarkus.github.io","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-supabase-api-version","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond(405,{error:"Method not allowed"});
 try{
 const base=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 if(!base||!service)return respond(500,{error:"Server configuration missing"});
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return respond(401,{error:"Sign in required"});
 const admin=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authErr}=await admin.auth.getUser(auth.slice(7));
 if(authErr||!user)return respond(401,{error:"Invalid session"});
 const {data:caller,error:roleError}=await admin.from("profiles").select("role").eq("id",user.id).single();
 if(roleError||caller?.role!=="owner")return respond(403,{error:"Only an Owner may manage team members"});
 const body=await req.json();
 const validRoles=["sales_partner","project_manager","specialist"];
 if(body.action==="invite"){
 const email=String(body.email||"").trim().toLowerCase();
 const role=String(body.role||"");
 const {data:existing}=await admin.from("profiles").select("id,role").ilike("email",email).maybeSingle();
 if(existing)return respond(409,{error:existing.role==="disabled"?"This account was previously removed. Contact the Owner to restore access.":"This email already has a CRM account. No new invitation was sent."});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!validRoles.includes(role))return respond(400,{error:"Valid email and team role required"});
 const {data, error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:"https://astarkmarkus.github.io/O45crm/"});
 if(error)return respond(400,{error:error.message});
 if(!data.user)return respond(500,{error:"Invitation did not create user"});
 const {error:upErr}=await admin.from("profiles").upsert({id:data.user.id,email,role},{onConflict:"id"});
 if(upErr)return respond(500,{error:"Invitation sent but role assignment failed. Correct role in Supabase before user signs in."});
 return respond(200,{ok:true,message:"Invitation sent"});
 }
 if(body.action==="remove_member"){
 const id=String(body.user_id||"");
 if(!/^[0-9a-f-]{36}$/i.test(id)||id===user.id)return respond(400,{error:"Invalid user or protected Owner account"});
 const {data:target,error:targetError}=await admin.from("profiles").select("role,email").eq("id",id).single();
 if(targetError||!target)return respond(404,{error:"Team member not found"});
 if(target.role==="owner")return respond(403,{error:"Owner accounts are protected"});
 if(target.role==="disabled")return respond(200,{ok:true,message:"Access already removed"});
 const {error:banError}=await admin.auth.admin.updateUserById(id,{ban_duration:"876000h"});
 if(banError)return respond(500,{error:"Could not disable sign-in: "+banError.message});
 const {error:disableError}=await admin.from("profiles").update({role:"disabled"}).eq("id",id);
 if(disableError)return respond(500,{error:"Account sign-in blocked, but team role could not be disabled: "+disableError.message});
 return respond(200,{ok:true,message:"Team member access removed. Existing CRM history was retained."});
 }
 if(body.action==="change_role"){
 const id=String(body.user_id||""),role=String(body.role||"");
 if(!validRoles.includes(role))return respond(400,{error:"Invalid role"});
 if(id===user.id)return respond(400,{error:"Cannot modify your own Owner role"});
 const {data:target}=await admin.from("profiles").select("role").eq("id",id).single();
 if(!target)return respond(404,{error:"User not found"});
 if(target.role==="owner")return respond(403,{error:"Other Owner accounts cannot be changed here"});
 const {error}=await admin.from("profiles").update({role}).eq("id",id);
 if(error)return respond(500,{error:error.message});
 return respond(200,{ok:true,message:"Role updated"});
 }
 return respond(400,{error:"Unsupported action"});
 }catch{return respond(500,{error:"Internal error"});}
});