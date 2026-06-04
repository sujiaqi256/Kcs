import { useState, useEffect, useCallback } from "react";
import { sb, getUser } from "../utils";

const MTAGS=["全部","数码","书籍","出行","生活","运动"];
const MC={数码:"#64B5F6",书籍:"#F0A500",出行:"#2ECC71",生活:"#CE93D8",运动:"#FF6B6B"};
const EMOJIS=["💻","📚","🚲","💡","💪","🎮","🏀","🎨","📎","🎵","📱","🎧","⌨️","📷","🧸","🍎","☕","🖊️"];

const formatTime=(ts)=>{
  if(!ts) return "";
  const utc=ts.endsWith("Z")?ts:ts+"Z";
  const diff=(Date.now()-new Date(utc))/1000;
  if(diff<60) return "刚刚";
  if(diff<3600) return `${Math.floor(diff/60)}分钟前`;
  if(diff<86400) return `${Math.floor(diff/3600)}小时前`;
  if(diff<2592000) return `${Math.floor(diff/86400)}天前`;
  const d=new Date(utc);
  return `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
};

// ChatModal placeholder - will be imported from CarpoolTab when fully extracted
let ChatModal = ({ride,onClose,contextMsg}) => {
  const user = getUser();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const otherId = ride?.user_id;
  const otherName = ride?.nickname || "用户";
  const otherAvatar = ride?.avatar || "🦊";

  useEffect(() => {
    if (!user || !otherId) return;
    const load = async () => {
      try {
        const data = await sb(`carpool_messages?or=(and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id}))&order=created_at.asc&limit=50`);
        setMessages(data || []);
        // Mark as read
        await sb(`carpool_messages?receiver_id=eq.${user.id}&sender_id=eq.${otherId}&is_read=eq.false`, { method: "PATCH", body: JSON.stringify({ is_read: true }), prefer: "return=minimal" });
      } catch(e) {}
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [user, otherId]);

  const send = async () => {
    if (!input.trim() || !user) return;
    const msg = input.trim();
    setInput("");
    try {
      await sb("carpool_messages", { method: "POST", body: JSON.stringify({ sender_id: user.id, receiver_id: otherId, content: msg, is_read: false }), prefer: "return=minimal" });
      setMessages(prev => [...prev, { sender_id: user.id, content: msg, created_at: new Date().toISOString() }]);
    } catch(e) {}
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"#0d1117",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#1a1a2e",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #ffffff0d"}}>
        <span onClick={onClose} style={{color:"#4DD0E1",fontSize:20,cursor:"pointer"}}>‹</span>
        <div style={{width:36,height:36,borderRadius:10,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{otherAvatar}</div>
        <div style={{color:"#fff",fontSize:15,fontWeight:600}}>{otherName}</div>
      </div>
      {contextMsg && (
        <div style={{padding:"8px 16px",background:"#1a2a3a",borderBottom:"1px solid #ffffff0d"}}>
          <div style={{color:"#888",fontSize:11,whiteSpace:"pre-wrap"}}>{contextMsg}</div>
        </div>
      )}
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
        {messages.map((m,i) => {
          const isMine = m.sender_id === user?.id;
          return (
            <div key={i} style={{display:"flex",justifyContent:isMine?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"75%",background:isMine?"#4DD0E1":"#1e2a3a",color:isMine?"#fff":"#ddd",padding:"10px 14px",borderRadius:isMine?"16px 16px 4px 16px":"16px 16px 16px 4px",fontSize:13,lineHeight:1.5}}>
                {m.content}
                <div style={{fontSize:9,color:isMine?"#ffffff88":"#666",marginTop:4,textAlign:"right"}}>{formatTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        {messages.length===0 && <div style={{textAlign:"center",color:"#555",padding:40,fontSize:13}}>开始聊天吧～</div>}
      </div>
      <div style={{background:"#1a1a2e",padding:"10px 16px",display:"flex",gap:8,borderTop:"1px solid #ffffff0d"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="输入消息..." style={{flex:1,background:"#1e2a3a",border:"1px solid #ffffff22",borderRadius:20,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none"}}/>
        <button onClick={send} style={{background:"#4DD0E1",border:"none",borderRadius:20,padding:"10px 18px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>发送</button>
      </div>
    </div>
  );
};

let ChatListModal = ({onClose,onOpenChat}) => {
  const user = getUser();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const sent = await sb(`carpool_messages?sender_id=eq.${user.id}&select=receiver_id&order=created_at.desc&limit=100`);
        const recv = await sb(`carpool_messages?receiver_id=eq.${user.id}&select=sender_id&order=created_at.desc&limit=100`);
        const ids = new Set();
        (sent||[]).forEach(m => ids.add(m.receiver_id));
        (recv||[]).forEach(m => ids.add(m.sender_id));
        const convos = [];
        for (const otherId of ids) {
          if (otherId === user.id) continue;
          const users = await sb(`users?id=eq.${otherId}&select=id,nickname,avatar`);
          if (users && users[0]) convos.push(users[0]);
        }
        setConversations(convos);
      } catch(e) {}
    };
    load();
  }, [user]);

  if (!user) return <div style={{position:"fixed",inset:0,zIndex:999,background:"#0d1117",display:"flex",alignItems:"center",justifyContent:"center",color:"#888"}}>请先登录</div>;

  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"#0d1117",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#1a1a2e",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #ffffff0d"}}>
        <span onClick={onClose} style={{color:"#4DD0E1",fontSize:20,cursor:"pointer"}}>‹</span>
        <div style={{color:"#fff",fontSize:16,fontWeight:700}}>消息列表</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
        {conversations.length === 0 ? (
          <div style={{textAlign:"center",color:"#555",padding:40,fontSize:13}}>暂无聊天记录</div>
        ) : conversations.map(c => (
          <div key={c.id} onClick={() => onOpenChat(c.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",borderBottom:"1px solid #ffffff08"}}>
            <div style={{width:44,height:44,borderRadius:12,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{c.avatar||"🦊"}</div>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontSize:14,fontWeight:600}}>{c.nickname||"用户"}</div>
            </div>
            <span style={{color:"#555",fontSize:16}}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function MarketPublishModal({onClose,onPublished}){
  const user=getUser();
  const [title,setTitle]=useState("");
  const [desc,setDesc]=useState("");
  const [category,setCategory]=useState("数码");
  const [condition,setCondition]=useState("九成新");
  const [price,setPrice]=useState("");
  const [originalPrice,setOriginalPrice]=useState("");
  const [contact,setContact]=useState("");
  const [emoji,setEmoji]=useState("💻");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  const handlePublish=async()=>{
    if(!title.trim()){setErr("请输入商品名称");return;}
    if(!price||isNaN(Number(price))){setErr("请输入正确的价格");return;}
    setLoading(true);
    try{
      await sb("market_items",{method:"POST",body:JSON.stringify({
        user_id:user.id,nickname:user.nickname,avatar:user.avatar,
        title:title.trim(),description:desc.trim(),
        price:Number(price),original_price:originalPrice?Number(originalPrice):null,
        category,condition:condition,contact,emoji,status:"active"
      }),prefer:"return=minimal"});
      onPublished();
    }catch(e){console.error(e);setErr("发布失败: "+e.message);}
    setLoading(false);
  };

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",padding:"20px 20px 40px",maxHeight:"85vh",overflowY:"auto",animation:"slideUp .3s ease"}}>
        <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:16}}>📦 发布闲置</div>
        <div style={{color:"#888",fontSize:12,marginBottom:6}}>图标</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {EMOJIS.map(e=>(
            <button key={e} onClick={()=>setEmoji(e)} style={{width:36,height:36,borderRadius:10,background:emoji===e?"#F06292":"#2a3a4a",border:"none",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{e}</button>
          ))}
        </div>
        <div style={{color:"#888",fontSize:12,marginBottom:6}}>商品名称</div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="如：九成新 MacBook Air" maxLength={30} style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",marginBottom:12}}/>
        <div style={{color:"#888",fontSize:12,marginBottom:6}}>描述</div>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="商品描述、成色、购买时间等..." maxLength={200} rows={3} style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",resize:"none",marginBottom:12}}/>
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{color:"#888",fontSize:12,marginBottom:6}}>分类</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {MTAGS.filter(t=>t!=="全部").map(t=>(
                <button key={t} onClick={()=>setCategory(t)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",background:category===t?(MC[t]||"#F06292"):"#2a3a4a",color:"#fff",fontSize:11,fontWeight:600}}>{t}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{color:"#888",fontSize:12,marginBottom:6}}>成色</div>
          <div style={{display:"flex",gap:6}}>
            {["全新","九成新","八成新","二手"].map(c=>(
              <button key={c} onClick={()=>setCondition(c)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",background:condition===c?"#F06292":"#2a3a4a",color:"#fff",fontSize:11,fontWeight:600}}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{color:"#888",fontSize:12,marginBottom:6}}>售价（元）</div>
            <input type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="¥" style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none"}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{color:"#888",fontSize:12,marginBottom:6}}>原价（选填）</div>
            <input type="number" value={originalPrice} onChange={e=>setOriginalPrice(e.target.value)} placeholder="¥" style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none"}}/>
          </div>
        </div>
        <div style={{color:"#888",fontSize:12,marginBottom:6}}>联系方式</div>
        <input value={contact} onChange={e=>setContact(e.target.value)} placeholder="微信号或手机号" maxLength={30} style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",marginBottom:16}}/>
        {err&&<div style={{color:"#FF6B6B",fontSize:12,marginBottom:10}}>{err}</div>}
        <button onClick={handlePublish} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#F06292,#9C27B0)",border:"none",borderRadius:16,padding:"14px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",opacity:loading?0.6:1}}>
          {loading?"发布中...":"发布商品"}
        </button>
      </div>
    </div>
  );
}

function MarketDetailModal({item,onClose,onDeleted}){
  const user=getUser();
  const isMine=user&&item.user_id===user.id;
  const [openChat,setOpenChat]=useState(false);

  const handleDelete=async()=>{
    if(!confirm("确定下架这件商品？"))return;
    try{
      await sb(`market_items?id=eq.${item.id}`,{method:"DELETE",prefer:"return=minimal"});
      onDeleted();
    }catch(e){alert("操作失败");}
  };

  if(openChat){
    const ctxMsg=`📦 商品信息\n${item.title}\n💰 ¥${item.price}${item.original_price?" (原价¥"+item.original_price+")":""}\n🏷️ ${item.category} · ${item.condition}`;
    return <ChatModal ride={{user_id:item.user_id,nickname:item.nickname,avatar:item.avatar,from_place:item.title,to_place:""}} onClose={()=>setOpenChat(false)} contextMsg={ctxMsg}/>;
  }

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",paddingBottom:40,animation:"slideUp .32s cubic-bezier(.22,1,.36,1)"}}>
        <div style={{width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"10px auto 0"}}/>
        <div style={{height:160,background:`linear-gradient(135deg,${MC[item.category]||"#F06292"}33,#2a3a4a)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:64,margin:"0 22px",borderRadius:16,marginTop:16,position:"relative"}}>
          {item.emoji||"📦"}
          <div style={{position:"absolute",top:10,left:10}}><span style={{background:(MC[item.category]||"#F06292")+"22",color:MC[item.category]||"#F06292",border:`1px solid ${MC[item.category]||"#F06292"}44`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>{item.category}</span></div>
          <div style={{position:"absolute",top:10,right:10}}><span style={{background:"#ffffff22",color:"#fff",borderRadius:20,padding:"3px 10px",fontSize:11}}>{item.condition}</span></div>
        </div>
        <div style={{padding:"16px 22px"}}>
          <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:6}}>{item.title}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:12}}>
            <span style={{color:"#F06292",fontSize:24,fontWeight:800}}>¥{item.price}</span>
            {item.original_price&&<span style={{color:"#555",fontSize:13,textDecoration:"line-through"}}>¥{item.original_price}</span>}
          </div>
          {item.description&&<div style={{color:"#ccc",fontSize:13,lineHeight:1.6,marginBottom:16,whiteSpace:"pre-wrap"}}>{item.description}</div>}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"12px",background:"#ffffff08",borderRadius:12}}>
            <div style={{width:40,height:40,borderRadius:10,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{item.avatar||"🦊"}</div>
            <div>
              <div style={{color:"#fff",fontSize:14,fontWeight:600}}>{item.nickname||"匿名"}</div>
              <div style={{color:"#888",fontSize:11}}>{formatTime(item.created_at)}</div>
            </div>
          </div>
          {item.contact&&(
            <div style={{padding:"10px 14px",background:"#F0629215",border:"1px solid #F0629233",borderRadius:12,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>📱</span>
              <span style={{color:"#F06292",fontSize:13,fontWeight:600,flex:1}}>{item.contact}</span>
              <button onClick={()=>{navigator.clipboard.writeText(item.contact);alert("已复制");}} style={{background:"#F0629222",border:"none",borderRadius:8,padding:"6px 10px",color:"#F06292",fontSize:11,fontWeight:600,cursor:"pointer"}}>复制</button>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            {isMine?(
              <button onClick={handleDelete} style={{flex:1,background:"#FF6B6B22",border:"1px solid #FF6B6B44",borderRadius:14,padding:"13px",color:"#FF6B6B",fontSize:14,fontWeight:700,cursor:"pointer"}}>下架商品</button>
            ):(
              <>
                <button onClick={()=>{if(user)setOpenChat(true);else alert("请先登录");}} style={{flex:1,background:"linear-gradient(135deg,#F06292,#9C27B0)",border:"none",borderRadius:14,padding:"13px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>💬 联系卖家</button>
                {item.contact&&<button onClick={()=>{navigator.clipboard.writeText(item.contact);alert("已复制联系方式");}} style={{background:"#ffffff11",border:"1px solid #ffffff22",borderRadius:14,padding:"13px 16px",color:"#aaa",fontSize:13,fontWeight:600,cursor:"pointer"}}>📱</button>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketTab({ refreshKey }){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tag,setTag]=useState("全部");
  const [searchText,setSearchText]=useState("");
  const [showPublish,setShowPublish]=useState(false);
  const [detailItem,setDetailItem]=useState(null);
  const [showChatList,setShowChatList]=useState(false);
  const [chatTarget,setChatTarget]=useState(null);
  const [unreadCount,setUnreadCount]=useState(0);
  const [user]=useState(()=>getUser());

  useEffect(()=>{
    if(!user) return;
    const loadUnread=async()=>{
      try{
        const data=await sb(`carpool_messages?receiver_id=eq.${user.id}&is_read=eq.false&select=id`);
        setUnreadCount(data?.length||0);
      }catch(e){}
    };
    loadUnread();
    const t=setInterval(loadUnread,30000);
    return()=>clearInterval(t);
  },[user]);

  const loadItems=useCallback(async(silent)=>{
    if(!silent)setLoading(true);
    try{
      const data=await sb("market_items?status=eq.active&order=created_at.desc&limit=50")||[];
      setItems(data);
    }catch(e){}
    if(!silent)setLoading(false);
  },[refreshKey]);

  useEffect(()=>{loadItems();},[loadItems]);
  useEffect(()=>{
    const t=setInterval(()=>loadItems(true),30000);
    return()=>clearInterval(t);
  },[loadItems]);

  const filtered=items.filter(m=>{
    if(tag!=="全部"&&m.category!==tag)return false;
    if(searchText.trim()){
      const s=searchText.trim().toLowerCase();
      return m.title.toLowerCase().includes(s)||(m.description||"").toLowerCase().includes(s);
    }
    return true;
  });

  return(
    <div style={{paddingBottom:100}}>
      {showPublish&&<MarketPublishModal onClose={()=>setShowPublish(false)} onPublished={()=>{setShowPublish(false);loadItems();}}/>}
      {detailItem&&<MarketDetailModal item={detailItem} onClose={()=>setDetailItem(null)} onDeleted={()=>{setDetailItem(null);loadItems();}}/>}
      {showChatList&&<ChatListModal onClose={()=>setShowChatList(false)} onOpenChat={(otherId)=>{setShowChatList(false);const it=items.find(x=>x.user_id===otherId);if(it)setChatTarget({user_id:it.user_id,nickname:it.nickname,avatar:it.avatar,from_place:it.title,to_place:""});else setChatTarget({user_id:otherId,nickname:"用户",avatar:"🦊",from_place:"",to_place:""});}}/>}
      {chatTarget&&<ChatModal ride={chatTarget} onClose={()=>setChatTarget(null)}/>}
      <div style={{background:"linear-gradient(135deg,#1a0a2e,#2d1b4e)",padding:"20px 16px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><div style={{color:"#fff",fontSize:22,fontWeight:800}}>二手集市</div><div style={{color:"#aaa",fontSize:12,marginTop:2}}>闲置流通，环保共享</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>{if(user)setShowChatList(true);else alert("请先登录");}} style={{position:"relative",background:"#ffffff15",border:"none",color:"#fff",width:38,height:38,borderRadius:12,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              💬
              {unreadCount>0&&<div style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:9,background:"#FF6B6B",color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{unreadCount}</div>}
            </button>
            <button onClick={()=>{if(user)setShowPublish(true);else alert("请先登录");}} style={{background:"#F06292",border:"none",color:"#fff",padding:"8px 16px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 卖东西</button>
          </div>
        </div>
        <div style={{background:"#ffffff15",borderRadius:14,padding:"10px 14px",display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:14}}>🔍</span>
          <input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="搜索商品..." style={{background:"none",border:"none",color:"#fff",fontSize:13,flex:1,outline:"none"}}/>
          {searchText&&<span onClick={()=>setSearchText("")} style={{color:"#888",cursor:"pointer",fontSize:14}}>✕</span>}
        </div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
          {MTAGS.map(t=>(
            <button key={t} onClick={()=>setTag(t)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",flexShrink:0,background:tag===t?(MC[t]||"#F06292"):"#ffffff22",color:"#fff",fontSize:12,fontWeight:600}}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {loading?(
          <div style={{gridColumn:"1/3",textAlign:"center",padding:"40px",color:"#555"}}>加载中...</div>
        ):filtered.length===0?(
          <div style={{gridColumn:"1/3",textAlign:"center",padding:"50px 20px"}}>
            <div style={{fontSize:44,marginBottom:10}}>📦</div>
            <div style={{color:"#ccc",fontSize:15,fontWeight:700}}>{searchText?"没有找到匹配的商品":"暂无商品"}</div>
            <div style={{color:"#666",fontSize:13,marginTop:6}}>{searchText?"换个关键词试试":"发布第一件闲置吧！"}</div>
          </div>
        ):filtered.map((item,i)=>(
          <div key={item.id} onClick={()=>setDetailItem(item)} style={{background:"#1e2a3a",borderRadius:18,overflow:"hidden",cursor:"pointer",animation:`slideIn .3s ease ${i*.07}s both`}}>
            <div style={{height:108,background:`linear-gradient(135deg,${MC[item.category]||"#F06292"}33,#2a3a4a)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:42,position:"relative"}}>
              {item.emoji||"📦"}
              <div style={{position:"absolute",top:8,left:8}}><span style={{background:(MC[item.category]||"#F06292")+"22",color:MC[item.category]||"#F06292",border:`1px solid ${MC[item.category]||"#F06292"}44`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:600}}>{item.category}</span></div>
            </div>
            <div style={{padding:"10px 10px 12px"}}>
              <div style={{color:"#fff",fontSize:12,fontWeight:700,marginBottom:3,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{item.title}</div>
              <div style={{color:"#888",fontSize:10,marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.description||"暂无描述"}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:5,marginBottom:6}}>
                <span style={{color:"#F06292",fontSize:16,fontWeight:800}}>¥{item.price}</span>
                {item.original_price&&<span style={{color:"#555",fontSize:10,textDecoration:"line-through"}}>¥{item.original_price}</span>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:"#888",fontSize:10}}>{item.nickname||"匿名"}</span>
                <span style={{color:"#555",fontSize:9}}>{item.condition}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
