<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-area">
      <div class="chat-header">
        <button class="btn-back" @click="$router.push('/groups')">&lt; 群</button>
        <span class="chat-title">{{ groupName }}</span>
        <span class="chat-sub">{{ memberCount }}人</span>
        <span class="invite-code">码:{{ inviteCode }}</span>
        <button class="btn-leave" @click="leaveGroup">x</button>
      </div>

      <!-- Agent work area — shared, collapsible -->
      <div v-if="agentActive" class="agent-area" :class="{ fold: agentFold }">
        <div class="agent-top" @click="agentFold=!agentFold">
          <span class="adot" :class="{ run:agentRun, ok:agentDone, err:agentErr }"></span>
          <span class="atitle">{{ agentRun ? (agentAct||'Agent working...') : (agentErr ? 'Error' : 'Done') }}</span>
          <span class="around" v-if="agentRun && agentRound">{{ agentRound }}/50</span>
          <span class="aarr">{{ agentFold ? '▸' : '▾' }}</span>
        </div>
        <div v-if="!agentFold" class="abody" ref="abodyRef">
          <div v-for="(e,i) in agentLog" :key="i" :class="['aline', e.type]">
            <template v-if="e.type==='thinking'"><span class="atxt dim">{{ e.text?.slice(0,150) }}</span></template>
            <template v-else-if="e.type==='tool_start'"><span class="adots"></span><span class="aact">{{ actMap(e.tool) }}</span><span class="adet">{{ det(e) }}</span></template>
            <template v-else-if="e.type==='tool_result' && ok(e.result)"><span class="atxt dim">{{ e.result?.slice(0,80) }}</span></template>
            <template v-else-if="e.type==='error'"><span class="atxt err">{{ e.text }}</span></template>
            <template v-else-if="e.type==='done'||e.type==='final'"><span class="atxt ok">{{ e.text||'Done.' }}</span></template>
          </div>
          <div v-if="agentRun" class="scanbar"></div>
        </div>
      </div>

      <div class="msg-list" ref="msgRef">
        <div v-if="loading" class="loading">Loading...</div>
        <div v-for="m in messages" :key="m._key" :class="['msg', m._isAi?'ai':(m._mine?'me':'them')]">
          <div class="msg-sender">{{ m._isAi?'DS':(m._mine?'我':(m.sender_name||'?')) }}</div>
          <div class="msg-bubble" :class="{'ai-b':m._isAi}">{{ m.text }}</div>
        </div>
        <div v-if="dsThinking" class="msg ai"><div class="msg-sender">DS</div><div class="msg-bubble ai-b thinking">{{ dsThinking }}</div></div>
        <div v-if="streamText" class="msg ai"><div class="msg-sender">DS</div><div class="msg-bubble ai-b">{{ streamText }}<span class="cursor"></span></div></div>
      </div>

      <div class="input-area">
        <textarea v-model="input" placeholder="@ds 提问或布置任务..." @keydown="onKey" :disabled="sending" rows="1"></textarea>
        <button class="btn-send" @click="send" :disabled="!input.trim()||sending">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { groups, getSavedUser } from '../api/index.js'
import { on as wsOn, send as wsSend } from '../api/ws.js'
import Sidebar from '../components/Sidebar.vue'

const route=useRoute(), router=useRouter()
const roomId=route.params.id
const groupName=ref(''), inviteCode=ref(''), memberCount=ref(0)
const myId=(getSavedUser()||{}).id||''
const messages=ref([]), input=ref(''), loading=ref(true), sending=ref(false)
const streamText=ref(''), dsThinking=ref(''), msgRef=ref(null), abodyRef=ref(null)
const seenIds=new Set(), unsubs=[]; let _k=0
function mk() { return 'k_'+ (++_k) }

// Agent state — shared via WS
const agentActive=ref(false), agentRun=ref(false), agentDone=ref(false), agentErr=ref(false)
const agentFold=ref(false), agentRound=ref(0), agentAct=ref('')
const agentLog=ref([]); let _aseen=new Set()

async function load() {
  try { const g=await groups.detail(roomId); groupName.value=g.name; inviteCode.value=g.invite_code; memberCount.value=g.members?.length||0
    const ms=await groups.messages(roomId); messages.value=[]; seenIds.clear()
    for(const m of ms) { const k='h_'+m.id; seenIds.add(k); messages.value.push({...m,_mine:m.sender_id===myId,_isAi:!!m.is_ai,_key:k}) }
  } catch { groupName.value=roomId } finally { loading.value=false; scrollB() }
}
function scrollB() { nextTick(()=>{ const e=msgRef.value; if(e) e.scrollTop=e.scrollHeight }) }
function scrollA() { nextTick(()=>{ const e=abodyRef.value; if(e) e.scrollTop=e.scrollHeight }) }

function upsert(m) {
  const d=(m.sender_id||'ai')+'|'+(m.text||'').slice(0,40)+'|'+(m.created_at||'').slice(0,16)
  if(seenIds.has(d)) return; seenIds.add(d)
  messages.value.push({...m,_mine:m.sender_id===myId,_isAi:!!m.is_ai,_key:mk()}); scrollB()
}

// Agent event handler (shared — all members see same events)
function onAgentEvent(evt) {
  if(!agentActive.value) { agentActive.value=true; agentRun.value=true; agentDone.value=false; agentErr.value=false; agentFold.value=false; agentLog.value=[]; agentRound.value=0; _aseen=new Set() }
  const dk=evt.type+'|'+(evt.tool||'')+'|'+(evt.round||'')
  if(_aseen.has(dk)) return; _aseen.add(dk)
  agentLog.value.push(evt)
  if(evt.type==='round') agentRound.value=evt.round
  if(evt.type==='tool_start') agentAct.value=actMap(evt.tool)
  if(evt.type==='done'||evt.type==='final') { agentRun.value=false; agentDone.value=true }
  if(evt.type==='error') { agentRun.value=false; agentErr.value=true }
  if(evt.type==='aborted') { agentRun.value=false; agentDone.value=true }
  scrollA()
}
function onAgentDone(r) {
  agentRun.value=false; agentDone.value=true
  const t='[DS-Agent] '+(r.text||'Done.')
  messages.value.push({_key:mk(),_mine:false,_isAi:true,room_id:roomId,sender_id:null,sender_name:'DS',text:t,is_ai:1,created_at:new Date().toISOString()})
  scrollB()
}

async function send() {
  const t=input.value.trim(); if(!t||sending.value) return
  input.value=''
  wsSend({type:'group_msg',roomId,text:t,isAi:false})

  const m=t.match(/@ds\s+(.+)/i)
  if(!m) return

  const task=m[1]; sending.value=true
  const apiKey=localStorage.getItem('apikey')||''

  // Check API key
  if(!apiKey) {
    const errMsg='[DS] 请先在首页设置 DeepSeek API Key'
    wsSend({type:'group_msg',roomId,text:errMsg,isAi:true})
    sending.value=false; scrollB(); return
  }

  // Complex task → Agent; simple → direct reply
  const complex = task.length > 30 && /写|创建|生成|做|改|项目|代码|帮我|build|create|make|fix|重构|开发|搭建|实现|部署|配置/i.test(task)

  if(complex) {
    // Start agent immediately — first thinking event becomes the natural acknowledgment
    dsThinking.value=''; scrollB()

    try {
      const abortCtrl = new AbortController()
      const r=await fetch('/api/agent/group-run',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('bbot_token'),'x-api-key':apiKey},body:JSON.stringify({task,roomId,model:'deepseek-v4-pro'}),signal:abortCtrl.signal})
      const reader=r.body.getReader(), dec=new TextDecoder(); let buf=''
      let firstAck = false
      while(true) { const {done,value}=await reader.read(); if(done) break; buf+=dec.decode(value,{stream:true})
        const lines=buf.split('\n'); buf=lines.pop()||''
        for(const l of lines) { if(l.startsWith('data:')) {
          let evt; try { evt=JSON.parse(l.slice(5).trim()) } catch { continue }
          onAgentEvent(evt)  // process shown only in top panel
          // First thinking message = AI-generated acknowledgment in chat
          if (!firstAck && evt.type === 'thinking' && evt.text) {
            firstAck = true
            const ack = evt.text.trim().split(/[。！？\n]/)[0].slice(0, 80)
            if (ack.length > 2) {
              wsSend({type:'group_msg',roomId,text:'[DS] '+ack+'… (查看顶部面板)',isAi:true})
            }
          }
          // Done → send result to chat
          if (evt.type === 'done' || evt.type === 'final') {
            const result = evt.text ? evt.text.slice(0, 200) : '任务完成'
            wsSend({type:'group_msg',roomId,text:'[DS] '+result,isAi:true})
          }
        }}
      }
    } catch(e) {
      if (e.name !== 'AbortError') {
        wsSend({type:'group_msg',roomId,text:'[DS] Agent 出错: '+e.message,isAi:true})
      }
    } finally {
      sending.value = false
      scrollB()
    }
  } else {
    // Direct DS reply
    dsThinking.value='思考中...'; streamText.value=''; scrollB()
    try {
      const rMsgs=messages.value.slice(-15).map(x=>({role:x._isAi?'assistant':'user',content:'['+(x._isAi?'DS':(x.sender_name||'?'))+']: '+x.text}))
      const {ai}=await import('../api/index.js')
      await ai.chatStream(
        [{role:'system',content:'你在开发者群聊中。简洁专业地回答问题，用中文。'},...rMsgs,{role:'user',content:task}],
        'deepseek-v4-flash',
        (full)=>{streamText.value=full;scrollB()},
        (full)=>{
          streamText.value=''; dsThinking.value=''
          wsSend({type:'group_msg',roomId,text:'[DS] '+full,isAi:true})
          scrollB(); sending.value=false
        },
        (err)=>{
          streamText.value=''; dsThinking.value=''
          wsSend({type:'group_msg',roomId,text:'[DS] 出错了: '+err.message,isAi:true})
          scrollB(); sending.value=false
        }
      )
    } catch(e) {
      streamText.value=''; dsThinking.value=''
      wsSend({type:'group_msg',roomId,text:'[DS] 请求失败: '+e.message,isAi:true})
      scrollB(); sending.value=false
    }
  }
  if(sending.value) sending.value=false
}

function onKey(e) { if(e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); send() } }
async function leaveGroup() { if(!confirm('退出群聊？')) return; try { await groups.leave(roomId); router.push('/groups') } catch(e) { alert(e.message) } }

function actMap(t) { const m={list_files:'Listing...',read_file:'Reading...',write_file:'Writing...',edit_file:'Editing...',glob:'Finding...',grep:'Searching...',run_command:'Running...',web_search:'Searching web...'}; return m[t]||t }
function det(e) { const a=e.args||{}; return a.path||a.pattern||a.query||a.command?.slice(0,50)||a.dir||'' }
function ok(r) { return r&&(r.startsWith('[ERROR]')||r.startsWith('[OK]')||r.startsWith('Error')||r.startsWith('[FILE]')||r.length<200) }

function setupWS() {
  unsubs.push(wsOn('group_msg',(m)=>{ if(m.message.room_id===roomId) upsert(m.message) }))
  unsubs.push(wsOn('agent_progress',(m)=>{ if(m.roomId===roomId&&m.event) onAgentEvent(m.event) }))
  unsubs.push(wsOn('agent_done',(m)=>{ if(m.roomId===roomId&&m.result) onAgentDone(m.result) }))
}
onMounted(()=>{ load(); setupWS() })
onUnmounted(()=>{ unsubs.forEach(f=>f()) })
</script>

<style scoped>
.app-layout{display:flex;height:100vh;height:100dvh;background:var(--bg);overflow:hidden}
.main-area{flex:1;min-width:0;display:flex;flex-direction:column;height:100vh;height:100dvh}
.chat-header{height:48px;padding:0 12px;display:flex;align-items:center;gap:8px;border-bottom:2px solid var(--border);flex-shrink:0;background:var(--bg)}
.btn-back{border:1px solid var(--border);background:none;color:var(--text-secondary);padding:4px 8px;font-size:11px;cursor:pointer}
.chat-title{font-size:14px;font-weight:600;color:var(--text);flex:1}
.chat-sub{font-size:11px;color:var(--text-muted)}
.invite-code{font-size:9px;color:var(--text-muted);border:1px solid var(--border);padding:2px 6px}
.btn-leave{border:1px solid var(--red);background:none;color:var(--red);width:22px;height:22px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.btn-leave:hover{background:var(--red);color:#fff}

/* Agent area */
.agent-area{border:1px solid var(--green);margin:0 12px;background:var(--bg);font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:10px;flex-shrink:0}
.agent-area.fold{margin-bottom:2px}
.agent-top{display:flex;align-items:center;gap:6px;padding:5px 8px;cursor:pointer;user-select:none;border-bottom:1px solid var(--border)}
.agent-top:hover{background:var(--bg-hover)}
.adot{width:6px;height:6px;border-radius:50%;background:var(--text-muted);flex-shrink:0}
.adot.run{background:var(--green);animation:pulse 1s infinite}
.adot.ok{background:var(--green)}
.adot.err{background:var(--red)}
.atitle{flex:1;font-size:10px;color:var(--text-secondary)}
.around{font-size:9px;color:var(--text-muted)}
.aarr{font-size:9px;color:var(--text-muted)}
.abody{max-height:220px;overflow-y:auto;padding:4px 8px;display:flex;flex-direction:column;gap:1px;position:relative}
.abody::-webkit-scrollbar{width:3px}
.abody::-webkit-scrollbar-thumb{background:var(--border)}
.aline{display:flex;align-items:baseline;gap:4px;line-height:1.35;padding:1px 0}
.adots{width:3px;height:3px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:4px}
.aact{color:var(--text-secondary);font-weight:500}
.adet{color:var(--text-muted);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}
.atxt.dim{color:var(--text-muted);font-size:10px}
.atxt.err{color:var(--red)}
.atxt.ok{color:var(--green)}
.scanbar{height:1px;background:linear-gradient(90deg,transparent,var(--green),transparent);animation:scan .5s ease-in-out infinite;margin-top:3px}
@keyframes scan{0%{opacity:0;transform:translateX(-100%)}50%{opacity:1}100%{opacity:0;transform:translateX(100%)}}

.msg-list{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-height:0}
.loading{text-align:center;font-size:12px;color:var(--text-muted);padding:20px}
.msg{max-width:75%;display:flex;flex-direction:column;gap:2px}
.msg.me{align-self:flex-end}
.msg.them{align-self:flex-start}
.msg.ai{align-self:flex-start;max-width:85%}
.msg-sender{font-size:9px;font-weight:600;color:var(--text-muted)}
.msg-bubble{border:1px solid var(--border);padding:6px 10px;font-size:13px;line-height:1.4;color:var(--text);background:var(--bg)}
.msg.me .msg-bubble{background:var(--primary-bg);border-color:var(--primary)}
.ai-b{border-color:var(--green);border-left:3px solid var(--green)}
.thinking{font-style:italic;color:var(--text-muted)}
.cursor{display:inline-block;width:5px;height:13px;background:var(--primary);animation:blink .8s infinite;vertical-align:middle}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}

.input-area{border-top:2px solid var(--border);padding:8px 14px;display:flex;gap:8px;flex-shrink:0;background:var(--bg)}
.input-area textarea{flex:1;border:1px solid var(--border);padding:7px 10px;font-size:13px;font-family:inherit;outline:none;resize:none;min-height:26px;max-height:90px;background:var(--bg);color:var(--text)}
.input-area textarea:focus{border-color:var(--primary)}
.btn-send{border:1px solid var(--primary);background:var(--primary);color:#fff;padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0}
.btn-send:disabled{opacity:.4;cursor:not-allowed}

@media(max-width:768px){.app-layout{position:fixed;top:0;left:0;right:0;bottom:0}.chat-header{padding:0 6px 0 28px;padding-top:env(safe-area-inset-top,0);min-height:44px;gap:4px}.agent-area{margin:0 6px}.abody{max-height:160px}.msg{max-width:88%!important}.input-area{padding:6px 10px;padding-bottom:max(10px,env(safe-area-inset-bottom,0))}.input-area textarea{font-size:15px}}
</style>
