import { useState, useEffect, useCallback, useRef } from "react";
import { sb, getUser } from "../utils";

// ─── 常量 ─────────────────────────────────────────────────────────────────
const PLACES=["广州应用科技学院（二期）-西南门","广州应用科技学院（一期）-东南门","肇庆东站","鼎湖东站","四会","莲花镇","广州南站","肇庆站"];
const ROUTE_TYPES=["全部","校区往返","高铁站","城际"];

const formatTime=(ts)=>{
  if(!ts) return "";
  // Supabase 返回的是 UTC 时间，需要补 Z 让 JS 按 UTC 解析
  const utc=ts.endsWith("Z")?ts:ts+"Z";
  const diff=(Date.now()-new Date(utc))/1000;
  if(diff<60) return "刚刚";
  if(diff<3600) return `${Math.floor(diff/60)}分钟前`;
  if(diff<86400) return `${Math.floor(diff/3600)}小时前`;
  if(diff<2592000) return `${Math.floor(diff/86400)}天前`;
  const d=new Date(utc);
  return `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
};

// ─── 路线热度排名弹窗 ──────────────────────────────────────────────────────
function RouteRankingModal({rides,onClose}){
  const routeCount={};
  rides.forEach(r=>{const k=`${r.from_place} → ${r.to_place}`;routeCount[k]=(routeCount[k]||0)+1;});
  const ranked=Object.entries(routeCount).sort((a,b)=>b[1]-a[1]);
  const maxCount=ranked[0]?.[1]||1;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",paddingBottom:40,animation:"slideUp .32s cubic-bezier(.22,1,.36,1)"}}>
        <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"10px auto 0"}}/>
        <div style={{padding:"16px 22px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{color:"#fff",fontSize:18,fontWeight:800}}>🔥 路线热度排名</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#888",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        {ranked.length===0?(
          <div style={{textAlign:"center",padding:"40px 20px",color:"#666",fontSize:13}}>暂无拼车数据</div>
        ):(
          <div style={{padding:"0 22px"}}>
            {ranked.map(([route,count],i)=>(
              <div key={route} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<ranked.length-1?"1px solid #ffffff0d":"none"}}>
                <div style={{width:24,height:24,borderRadius:8,background:i<3?["#FFD700","#C0C0C0","#CD7F32"][i]:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",color:i<3?"#000":"#888",fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#fff",fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{route}</div>
                  <div style={{marginTop:4,height:4,background:"#ffffff11",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${(count/maxCount)*100}%`,height:"100%",background:"linear-gradient(90deg,#F0A500,#FF8A65)",borderRadius:2,transition:"width .3s"}}/>
                  </div>
                </div>
                <div style={{color:"#F0A500",fontSize:14,fontWeight:800,flexShrink:0}}>{count}次</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 拼车主页 ──────────────────────────────────────────────────────────────
function CarpoolTab({ refreshKey }){
  const [rides,setRides]=useState([]);
  const [loading,setLoading]=useState(true);
  const [searchText,setSearchText]=useState("");
  const [activeType,setActiveType]=useState("全部");
  const [showPublish,setShowPublish]=useState(false);
  const [detailRide,setDetailRide]=useState(null);
  const [showChatList,setShowChatList]=useState(false);
  const [chatTarget,setChatTarget]=useState(null);
  const [unreadCount,setUnreadCount]=useState(0);
  const [showRouteRank,setShowRouteRank]=useState(false);
  const [user]=useState(()=>getUser());

  // 加载未读消息数
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

  const loadRides=useCallback(async(silent)=>{
    if(!silent)setLoading(true);
    try{
      const today=new Date().toISOString().slice(0,10);
      let q=`carpool?ride_date=gte.${today}&order=ride_date.asc,ride_time.asc&limit=50`;
      const data=await sb(q)||[];
      const updated=data.map(r=>({...r,status:r.seats_taken>=r.seats_total?"full":r.status}));
      setRides(updated);
    }catch(e){}
    if(!silent)setLoading(false);
  },[refreshKey]);

  useEffect(()=>{loadRides();},[loadRides]);
  useEffect(()=>{
    const t=setInterval(()=>loadRides(true),30000);
    return()=>clearInterval(t);
  },[loadRides]);

  // 搜索+筛选
  const filtered=rides.filter(r=>{
    if(activeType!=="全部"&&r.route_type!==activeType)return false;
    if(searchText.trim()){
      const s=searchText.trim().toLowerCase();
      return r.from_place.toLowerCase().includes(s)||r.to_place.toLowerCase().includes(s);
    }
    return true;
  });

  // 统计
  const todayStr=new Date().toISOString().slice(0,10);
  const todayCount=rides.filter(r=>r.ride_date===todayStr).length;
  const totalSuccess=rides.reduce((s,r)=>s+(r.seats_taken||0),0);
  const routeCount={};
  rides.forEach(r=>{const k=`${r.from_place}↔${r.to_place}`;routeCount[k]=(routeCount[k]||0)+1;});
  const topRoute=Object.entries(routeCount).sort((a,b)=>b[1]-a[1])[0];
  const topRouteStr=topRoute?topRoute[0]:"暂无数据";

  return(
    <div style={{paddingBottom:100}}>
      {showPublish&&<CarpoolPublishModal onClose={()=>setShowPublish(false)} onPublished={()=>{setShowPublish(false);loadRides();}}/>}
      {detailRide&&<CarpoolDetailModal ride={detailRide} onClose={()=>setDetailRide(null)} onDeleted={()=>{setDetailRide(null);loadRides();}}/>}
      {showChatList&&<ChatListModal onClose={()=>setShowChatList(false)} onOpenChat={(otherId)=>{setShowChatList(false);const r=rides.find(x=>x.user_id===otherId);if(r)setChatTarget(r);else setChatTarget({user_id:otherId,nickname:"用户",avatar:"🦊",from_place:"",to_place:""});}}/>}
      {chatTarget&&<ChatModal ride={chatTarget} onClose={()=>setChatTarget(null)}/>}
      {showRouteRank&&<RouteRankingModal rides={rides} onClose={()=>setShowRouteRank(false)}/>}

      {/* 顶部 */}
      <div style={{background:"linear-gradient(135deg,#0d2137,#1a3a5c)",padding:"20px 16px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><div style={{color:"#fff",fontSize:22,fontWeight:800}}>校园拼车</div><div style={{color:"#aaa",fontSize:12,marginTop:2}}>省钱·安全·顺风</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>{if(user)setShowChatList(true);else alert("请先登录");}} style={{position:"relative",background:"#ffffff15",border:"none",color:"#fff",width:38,height:38,borderRadius:12,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              💬
              {unreadCount>0&&<div style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:9,background:"#FF6B6B",color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{unreadCount}</div>}
            </button>
            <button onClick={()=>{if(user){setShowPublish(true);}else{alert("请先登录");}}} style={{background:"#F0A500",border:"none",color:"#fff",padding:"8px 16px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 发起拼车</button>
          </div>
        </div>
        {/* 搜索 */}
        <div style={{background:"#ffffff15",borderRadius:14,padding:"10px 14px",display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:14}}>🔍</span>
          <input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="搜索出发地或目的地..." style={{background:"none",border:"none",color:"#fff",fontSize:13,flex:1,outline:"none"}}/>
          {searchText&&<span onClick={()=>setSearchText("")} style={{color:"#888",cursor:"pointer",fontSize:14}}>✕</span>}
        </div>
        {/* 分类标签 */}
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
          {ROUTE_TYPES.map(t=>(
            <button key={t} onClick={()=>setActiveType(t)} style={{padding:"5px 14px",borderRadius:20,border:"none",cursor:"pointer",flexShrink:0,background:activeType===t?"#F0A500":"#ffffff22",color:"#fff",fontSize:12,fontWeight:600}}>{t}</button>
          ))}
        </div>
      </div>

      {/* 统计 */}
      <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div style={{background:"#1e2a3a",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
          <div style={{fontSize:16,marginBottom:2}}>🚗</div>
          <div style={{color:"#F0A500",fontSize:14,fontWeight:800}}>{todayCount}趟</div>
          <div style={{color:"#888",fontSize:9,marginTop:1}}>今日发车</div>
        </div>
        <div style={{background:"#1e2a3a",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
          <div style={{fontSize:16,marginBottom:2}}>👥</div>
          <div style={{color:"#F0A500",fontSize:14,fontWeight:800}}>{totalSuccess}次</div>
          <div style={{color:"#888",fontSize:9,marginTop:1}}>已拼成功</div>
        </div>
        <div onClick={()=>setShowRouteRank(true)} style={{background:"#1e2a3a",borderRadius:12,padding:"10px 8px",textAlign:"center",cursor:"pointer"}}>
          <div style={{fontSize:16,marginBottom:2}}>📍</div>
          <div style={{color:"#F0A500",fontSize:11,fontWeight:800,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{topRouteStr}</div>
          <div style={{color:"#888",fontSize:9,marginTop:1}}>热门路线 ›</div>
        </div>
      </div>

      {/* 列表 */}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:12}}>
        {loading?(
          <div style={{textAlign:"center",padding:"40px",color:"#555"}}>
            <div style={{fontSize:30,marginBottom:10,animation:"spin 1s linear infinite"}}>⏳</div>
            <div style={{fontSize:13}}>加载中...</div>
          </div>
        ):filtered.length===0?(
          <div style={{textAlign:"center",padding:"50px 20px"}}>
            <div style={{fontSize:44,marginBottom:10}}>🚗</div>
            <div style={{color:"#ccc",fontSize:15,fontWeight:700}}>{searchText?"没有找到匹配的拼车":"暂无拼车信息"}</div>
            <div style={{color:"#666",fontSize:13,marginTop:6}}>{searchText?"换个关键词试试":"发起第一趟拼车吧！"}</div>
          </div>
        ):filtered.map((r,i)=>{
          const isFull=r.seats_taken>=r.seats_total;
          const isMine=user&&r.user_id===user.id;
          const seatPct=Math.round((r.seats_taken/r.seats_total)*100);
          const rideDate=new Date(r.ride_date+"T00:00:00");
          const dateStr=`${rideDate.getMonth()+1}/${rideDate.getDate()} 周${"日一二三四五六"[rideDate.getDay()]}`;
          const timeDisplay=r.ride_time?.includes("-")?r.ride_time:r.ride_time?.slice(0,5)||"";
          return(
            <div key={r.id} onClick={()=>setDetailRide(r)} style={{background:"#1e2a3a",borderRadius:18,padding:16,animation:`slideIn .3s ease ${i*.05}s both`,cursor:"pointer"}}>
              {/* 顶部：头像+昵称+价格 */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{width:40,height:40,borderRadius:12,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{r.avatar||"🦊"}</div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:"#fff",fontSize:13,fontWeight:700}}>{r.nickname||"匿名"}</span>
                      {isMine&&<span style={{background:"#4DD0E122",color:"#4DD0E1",borderRadius:10,padding:"1px 6px",fontSize:9,fontWeight:600}}>我发布的</span>}
                    </div>
                    <div style={{color:"#888",fontSize:11}}>{dateStr}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:"#F0A500",fontSize:20,fontWeight:800}}>¥{r.price}</div>
                  <div style={{color:"#aaa",fontSize:10}}>每人</div>
                </div>
              </div>
              {/* 出发时间 - 醒目显示 */}
              <div style={{background:"#F0A50015",border:"1px solid #F0A50033",borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>🕐</span>
                <span style={{color:"#F0A500",fontSize:16,fontWeight:800,letterSpacing:0.5}}>{timeDisplay}</span>
                {r.ride_time?.includes("-")&&<span style={{color:"#aaa",fontSize:11}}>出发</span>}
              </div>
              {/* 路线 */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <div style={{background:"#2ECC7122",color:"#2ECC71",padding:"6px 12px",borderRadius:10,fontSize:12,fontWeight:600,flex:1,textAlign:"center"}}>{r.from_place}</div>
                <span style={{color:"#F0A500",fontSize:16,fontWeight:900}}>→</span>
                <div style={{background:"#4DD0E122",color:"#4DD0E1",padding:"6px 12px",borderRadius:10,fontSize:12,fontWeight:600,flex:1,textAlign:"center"}}>{r.to_place}</div>
              </div>
              {/* 底部：座位+状态 */}
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{background:isFull?"#FF6B6B22":"#CE93D822",color:isFull?"#FF6B6B":"#CE93D8",border:`1px solid ${isFull?"#FF6B6B44":"#CE93D844"}`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600}}>
                  {isFull?"已满":`💺 剩${r.seats_total-r.seats_taken}座`}
                </span>
                <span style={{background:"#ffffff0d",color:"#888",borderRadius:20,padding:"2px 8px",fontSize:10}}>{r.route_type}</span>
                {/* 座位进度条 */}
                <div style={{marginLeft:"auto",width:60,height:4,background:"#ffffff11",borderRadius:2,overflow:"hidden"}}>
                  <div style={{width:`${seatPct}%`,height:"100%",background:isFull?"#FF6B6B":"#F0A500",borderRadius:2,transition:"width .3s"}}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 发布拼车弹窗 ────────────────────────────────────────────────────────────
function CarpoolPublishModal({onClose,onPublished}){
  const user=getUser();
  const [fromPlace,setFromPlace]=useState("");
  const [toPlace,setToPlace]=useState("");
  const [rideDate,setRideDate]=useState("");
  const [rideTimeStart,setRideTimeStart]=useState("");
  const [rideTimeEnd,setRideTimeEnd]=useState("");
  const [seats,setSeats]=useState(3);
  const [price,setPrice]=useState("");
  const [routeType,setRouteType]=useState("校区往返");
  const [note,setNote]=useState("");
  const [contact,setContact]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  // 未来14天日期选项
  const dateOptions=Array.from({length:14},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()+i);
    return{value:d.toISOString().slice(0,10),label:`${d.getMonth()+1}/${d.getDate()} 周${"日一二三四五六"[d.getDay()]}`};
  });

  const handlePublish=async()=>{
    if(!fromPlace){setErr("请选择出发地");return;}
    if(!toPlace){setErr("请选择目的地");return;}
    if(fromPlace===toPlace){setErr("出发地和目的地不能相同");return;}
    if(!rideDate){setErr("请选择日期");return;}
    if(!rideTimeStart){setErr("请选择最早出发时间");return;}
    if(!/^\d{2}:\d{2}$/.test(rideTimeStart)||Number(rideTimeStart.slice(0,2))>23||Number(rideTimeStart.slice(3))>59){setErr("时间格式不正确");return;}
    if(rideTimeEnd){
      if(!/^\d{2}:\d{2}$/.test(rideTimeEnd)||Number(rideTimeEnd.slice(0,2))>23||Number(rideTimeEnd.slice(3))>59){setErr("时间格式不正确");return;}
      if(rideTimeEnd<rideTimeStart){setErr("最晚时间不能早于最早时间");return;}
    }
    if(!price||isNaN(Number(price))){setErr("请输入正确的价格");return;}
    const rideTime=rideTimeEnd?`${rideTimeStart}-${rideTimeEnd}`:rideTimeStart;
    setLoading(true);
    try{
      await sb("carpool",{method:"POST",body:JSON.stringify({
        user_id:user.id,nickname:user.nickname,avatar:user.avatar,
        from_place:fromPlace,to_place:toPlace,
        ride_date:rideDate,ride_time:rideTime,
        seats_total:seats,seats_taken:0,
        price:Number(price),route_type:routeType,note,contact,status:"active"
      }),prefer:"return=minimal"});
      onPublished();
    }catch(e){console.error("拼车发布错误:",e);setErr("发布失败: "+(e.message||"请重试"));}
    setLoading(false);
  };

  const quickSwap=()=>{setFromPlace(toPlace);setToPlace(fromPlace);};

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",padding:"20px 20px 40px",maxHeight:"85vh",overflowY:"auto",animation:"slideUp .3s ease"}}>
        <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:16}}>🚗 发起拼车</div>

        {/* 出发地/目的地 */}
        <div style={{color:"#888",fontSize:12,marginBottom:6}}>路线</div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <input list="places-from" value={fromPlace} onChange={e=>setFromPlace(e.target.value)} placeholder="出发地" style={{flex:1,background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none"}}/>
          <span onClick={quickSwap} style={{color:"#F0A500",fontSize:18,cursor:"pointer",flexShrink:0}}>⇄</span>
          <input list="places-to" value={toPlace} onChange={e=>setToPlace(e.target.value)} placeholder="目的地" style={{flex:1,background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none"}}/>
        </div>
        <datalist id="places-from">
          {PLACES.map(p=><option key={p} value={p}/>)}
        </datalist>
        <datalist id="places-to">
          {PLACES.map(p=><option key={p} value={p}/>)}
        </datalist>

        {/* 日期+时间 */}
        <div style={{marginBottom:12}}>
          <div style={{color:"#888",fontSize:12,marginBottom:4}}>日期</div>
          <select value={rideDate} onChange={e=>setRideDate(e.target.value)} style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:rideDate?"#fff":"#888",fontSize:13,outline:"none",appearance:"none"}}>
            <option value="">选择日期</option>
            {dateOptions.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{color:"#888",fontSize:12,marginBottom:4}}>最早出发</div>
            <input type="time" value={rideTimeStart} onChange={e=>setRideTimeStart(e.target.value)} style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:rideTimeStart?"#fff":"#888",fontSize:13,outline:"none"}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{color:"#888",fontSize:12,marginBottom:4}}>最晚出发（选填）</div>
            <input type="time" value={rideTimeEnd} onChange={e=>setRideTimeEnd(e.target.value)} style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:rideTimeEnd?"#fff":"#888",fontSize:13,outline:"none"}}/>
          </div>
        </div>

        {/* 座位+价格 */}
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{color:"#888",fontSize:12,marginBottom:4}}>座位数</div>
            <div style={{display:"flex",gap:6}}>
              {[1,2,3,4,5,6].map(n=>(
                <button key={n} onClick={()=>setSeats(n)} style={{flex:1,background:seats===n?"#F0A500":"#2a3a4a",border:"none",borderRadius:10,padding:"8px 0",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{n}</button>
              ))}
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{color:"#888",fontSize:12,marginBottom:4}}>每人价格（元）</div>
            <input type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="¥" style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none"}}/>
          </div>
        </div>

        {/* 路线类型 */}
        <div style={{color:"#888",fontSize:12,marginBottom:6}}>路线类型</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {["校区往返","高铁站","城际"].map(t=>(
            <button key={t} onClick={()=>setRouteType(t)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",background:routeType===t?"#F0A500":"#2a3a4a",color:"#fff",fontSize:12,fontWeight:600}}>{t}</button>
          ))}
        </div>

        {/* 备注 */}
        <div style={{color:"#888",fontSize:12,marginBottom:6}}>备注（选填）</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="如：途经广州南站、可放行李..." maxLength={100} rows={2} style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",resize:"none",marginBottom:12}}/>

        <div style={{color:"#888",fontSize:12,marginBottom:6}}>联系方式</div>
        <input value={contact} onChange={e=>setContact(e.target.value)} placeholder="微信号或手机号（方便乘客联系你）" maxLength={30} style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",marginBottom:12}}/>

        {err&&<div style={{color:"#FF6B6B",fontSize:12,marginBottom:8}}>{err}</div>}
        <button onClick={handlePublish} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#F0A500,#FF8A65)",border:"none",borderRadius:16,padding:"14px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",opacity:loading?0.6:1}}>
          {loading?"发布中...":"发布拼车"}
        </button>
      </div>
    </div>
  );
}

// ─── 拼车详情弹窗 ────────────────────────────────────────────────────────────
function CarpoolDetailModal({ride,onClose,onDeleted}){
  const user=getUser();
  const isMine=user&&ride.user_id===user.id;
  const isFull=ride.seats_taken>=ride.seats_total;
  const rideDate=new Date(ride.ride_date+"T00:00:00");
  const dateStr=`${rideDate.getFullYear()}.${rideDate.getMonth()+1}.${rideDate.getDate()} 周${"日一二三四五六"[rideDate.getDay()]}`;
  const [openChat,setOpenChat]=useState(false);

  const handleDelete=async()=>{
    if(!confirm("确定删除这条拼车？"))return;
    try{
      await sb(`carpool?id=eq.${ride.id}`,{method:"DELETE",prefer:"return=minimal"});
      onDeleted();
    }catch(e){alert("删除失败");}
  };

  if(openChat){
    const timeLabel=ride.ride_time?.includes("-")?ride.ride_time:ride.ride_time?.slice(0,5);
    const remain=ride.seats_total-(ride.seats_taken||0);
    const ctxMsg=`🚗 拼车信息\n${ride.from_place} → ${ride.to_place}\n📅 ${ride.ride_date} ${timeLabel}出发\n💰 ¥${ride.price}/人 · ${remain>0?"剩"+remain+"座":"已满"}`;
    return <ChatModal ride={ride} onClose={()=>setOpenChat(false)} contextMsg={ctxMsg}/>;
  }

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",paddingBottom:40,animation:"slideUp .32s cubic-bezier(.22,1,.36,1)"}}>
        <div style={{width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"10px auto 0"}}/>
        {/* 发布者 */}
        <div style={{display:"flex",gap:12,alignItems:"center",padding:"18px 22px 16px",borderBottom:"1px solid #ffffff0d"}}>
          <div style={{width:48,height:48,borderRadius:14,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{ride.avatar||"🦊"}</div>
          <div style={{flex:1}}>
            <div style={{color:"#fff",fontSize:16,fontWeight:700}}>{ride.nickname||"匿名"}</div>
            <div style={{color:"#888",fontSize:12}}>{dateStr} · {ride.ride_time?.includes("-")?ride.ride_time:ride.ride_time?.slice(0,5)}出发</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:"#F0A500",fontSize:24,fontWeight:800}}>¥{ride.price}</div>
            <div style={{color:"#aaa",fontSize:11}}>每人</div>
          </div>
        </div>
        {/* 路线 */}
        <div style={{padding:"16px 22px",borderBottom:"1px solid #ffffff0d"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:10,height:10,borderRadius:5,background:"#2ECC71"}}/>
            <div style={{flex:1}}>
              <div style={{color:"#888",fontSize:11}}>出发地</div>
              <div style={{color:"#fff",fontSize:15,fontWeight:600}}>{ride.from_place}</div>
            </div>
          </div>
          <div style={{width:1,height:24,background:"#ffffff15",marginLeft:4,margin:"4px 0"}}/>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:10,height:10,borderRadius:5,background:"#FF6B6B"}}/>
            <div style={{flex:1}}>
              <div style={{color:"#888",fontSize:11}}>目的地</div>
              <div style={{color:"#fff",fontSize:15,fontWeight:600}}>{ride.to_place}</div>
            </div>
          </div>
        </div>
        {/* 信息 */}
        {[
          ["💺","座位",`${ride.seats_taken}/${ride.seats_total} 已报名`],
          ["🏷️","类型",ride.route_type||"校区往返"],
          ["📝","备注",ride.note||"无"],
        ].map(([icon,label,val],i,arr)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 22px",borderBottom:i<arr.length-1?"1px solid #ffffff08":"none"}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{icon}</div>
            <div>
              <div style={{color:"#888",fontSize:11,marginBottom:2}}>{label}</div>
              <div style={{color:"#fff",fontSize:14,fontWeight:600}}>{val}</div>
            </div>
          </div>
        ))}
        {/* 联系方式 */}
        {ride.contact&&(
          <div style={{margin:"0 22px",padding:"14px 16px",background:"#4DD0E115",border:"1px solid #4DD0E133",borderRadius:14,display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:20}}>📱</div>
            <div style={{flex:1}}>
              <div style={{color:"#888",fontSize:11,marginBottom:2}}>联系方式</div>
              <div style={{color:"#4DD0E1",fontSize:15,fontWeight:700,wordBreak:"break-all"}}>{ride.contact}</div>
            </div>
            <button onClick={()=>{navigator.clipboard.writeText(ride.contact);alert("已复制到剪贴板");}} style={{background:"#4DD0E122",border:"none",borderRadius:10,padding:"8px 12px",color:"#4DD0E1",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>复制</button>
          </div>
        )}
        {/* 按钮 */}
        <div style={{padding:"16px 22px 0",display:"flex",gap:10}}>
          {isMine?(
            <button onClick={handleDelete} style={{flex:1,background:"#FF6B6B22",border:"1px solid #FF6B6B44",borderRadius:14,padding:"13px",color:"#FF6B6B",fontSize:14,fontWeight:700,cursor:"pointer"}}>删除拼车</button>
          ):(
            <>
              <button disabled={isFull} onClick={()=>{if(!isFull&&user){setOpenChat(true);}else if(!user){alert("请先登录");}}} style={{flex:1,background:isFull?"#333":"linear-gradient(135deg,#4DD0E1,#64B5F6)",border:"none",borderRadius:14,padding:"13px",color:"#fff",fontSize:14,fontWeight:700,cursor:isFull?"not-allowed":"pointer",opacity:isFull?0.5:1}}>
                {isFull?"已满员":"💬 联系 TA"}
              </button>
              {ride.contact&&<button onClick={()=>{navigator.clipboard.writeText(ride.contact);alert("已复制联系方式");}} style={{background:"#ffffff11",border:"1px solid #ffffff22",borderRadius:14,padding:"13px 16px",color:"#aaa",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>📱</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 聊天弹窗 ────────────────────────────────────────────────────────────────
function ChatModal({ride,onClose,contextMsg}){
  const user=getUser();
  const otherName=ride.nickname||"匿名";
  const otherAvatar=ride.avatar||"🦊";
  const otherId=ride.user_id;
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const listRef=useRef(null);

  const loadMessages=useCallback(async()=>{
    if(!user) return;
    try{
      const data=await sb(`carpool_messages?or=(and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id}))&order=created_at.asc&limit=100`);
      setMessages(data||[]);
      setTimeout(()=>{if(listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight;},50);
    }catch(e){}
  },[user,otherId]);

  useEffect(()=>{loadMessages();},[loadMessages]);

  const handleSendContext=async()=>{
    if(!contextMsg||!user||loading) return;
    setLoading(true);
    try{
      const res=await sb("carpool_messages",{method:"POST",body:JSON.stringify({sender_id:user.id,receiver_id:otherId,content:contextMsg})});
      setMessages(m=>[...m,res[0]]);
      setTimeout(()=>{if(listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight;},50);
    }catch(e){}
    setLoading(false);
  };
  useEffect(()=>{
    const t=setInterval(loadMessages,15000);
    return()=>clearInterval(t);
  },[loadMessages]);

  // 标记已读
  useEffect(()=>{
    if(!user) return;
    sb(`carpool_messages?sender_id=eq.${otherId}&receiver_id=eq.${user.id}&is_read=eq.false`,{method:"PATCH",body:JSON.stringify({is_read:true}),prefer:"return=minimal"}).catch(()=>{});
  },[user,otherId,messages]);

  const handleSend=async()=>{
    if(!input.trim()||!user) return;
    const content=input.trim();
    setInput("");
    setLoading(true);
    try{
      const res=await sb("carpool_messages",{method:"POST",body:JSON.stringify({sender_id:user.id,receiver_id:otherId,carpool_id:ride.id,content})});
      setMessages(m=>[...m,res[0]]);
      setTimeout(()=>{if(listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight;},50);
    }catch(e){console.error("发送消息失败:",e);alert("发送失败: "+e.message);}
    setLoading(false);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:999,background:"#0d1117",display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}}>
      {/* 顶部栏 */}
      <div style={{background:"#1a1a2e",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#4DD0E1",fontSize:20,cursor:"pointer",padding:4}}>←</button>
        <div style={{width:36,height:36,borderRadius:10,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{otherAvatar}</div>
        <div style={{flex:1}}>
          <div style={{color:"#fff",fontSize:14,fontWeight:700}}>{otherName}</div>
          <div style={{color:"#888",fontSize:11}}>{ride.from_place} → {ride.to_place}</div>
        </div>
      </div>
      {/* 消息列表 */}
      <div ref={listRef} style={{flex:1,overflowY:"auto",padding:"16px"}}>
        {messages.length===0&&<div style={{color:"#555",fontSize:13,textAlign:"center",padding:"60px 0"}}>开始和 {otherName} 聊天吧</div>}
        {messages.map((m,i)=>{
          const isMine=m.sender_id===user?.id;
          const showTime=i===0||(m.created_at&&messages[i-1]&&(new Date(m.created_at)-new Date(messages[i-1].created_at))>300000);
          return(
            <div key={m.id}>
              {showTime&&<div style={{color:"#555",fontSize:10,textAlign:"center",margin:"12px 0 6px"}}>{formatTime(m.created_at)}</div>}
              <div style={{display:"flex",justifyContent:isMine?"flex-end":"flex-start",marginBottom:8}}>
                {!isMine&&<div style={{width:32,height:32,borderRadius:8,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,marginRight:8,flexShrink:0}}>{otherAvatar}</div>}
                <div style={{maxWidth:"70%",background:isMine?"#4DD0E1":"#1e2a3a",color:isMine?"#000":"#ddd",padding:"10px 14px",borderRadius:isMine?"16px 16px 4px 16px":"16px 16px 16px 4px",fontSize:13,lineHeight:1.5,wordBreak:"break-word"}}>{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* 底部输入 */}
      {user?(
        <div style={{padding:"10px 16px 28px",borderTop:"1px solid #ffffff0d",background:"#1a1a2e",flexShrink:0}}>
          {contextMsg&&(
            <div style={{marginBottom:8}}>
              <button onClick={handleSendContext} disabled={loading} style={{width:"100%",background:"#F0A50022",border:"1px solid #F0A50044",borderRadius:12,padding:"10px",color:"#F0A500",fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left"}}>
                📋 发送信息卡（{contextMsg.split("\n")[0]}）
              </button>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder="输入消息..." onKeyDown={e=>e.key==="Enter"&&handleSend()}
              style={{flex:1,background:"#2a3a4a",border:"1px solid #ffffff11",borderRadius:20,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none"}}/>
            <button onClick={handleSend} disabled={loading||!input.trim()} style={{background:"#4DD0E1",border:"none",borderRadius:20,padding:"10px 16px",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer",opacity:loading||!input.trim()?0.5:1}}>发送</button>
          </div>
        </div>
      ):(
        <div style={{padding:"12px 16px 28px",color:"#888",fontSize:13,textAlign:"center",background:"#1a1a2e",borderTop:"1px solid #ffffff0d"}}>请先登录</div>
      )}
    </div>
  );
}

// ─── 会话列表弹窗 ────────────────────────────────────────────────────────────
function ChatListModal({onClose,onOpenChat}){
  const user=getUser();
  const [conversations,setConversations]=useState([]);
  const [loading,setLoading]=useState(true);

  const loadConversations=useCallback(async()=>{
    if(!user) return;
    try{
      const data=await sb(`carpool_messages?or=(sender_id.eq.${user.id},receiver_id.eq.${user.id})&order=created_at.desc&limit=200`);
      const map={};
      (data||[]).forEach(m=>{
        const otherId=m.sender_id===user.id?m.receiver_id:m.sender_id;
        if(!map[otherId]||new Date(m.created_at)>new Date(map[otherId].lastMsg.created_at)){
          map[otherId]={otherId,lastMsg:m,unread:m.receiver_id===user.id&&!m.is_read?1:0};
        } else if(m.receiver_id===user.id&&!m.is_read){
          map[otherId].unread++;
        }
      });
      setConversations(Object.values(map).sort((a,b)=>new Date(b.lastMsg.created_at)-new Date(a.lastMsg.created_at)));
    }catch(e){}
    setLoading(false);
  },[user]);

  useEffect(()=>{loadConversations();},[loadConversations]);
  useEffect(()=>{
    const t=setInterval(loadConversations,30000);
    return()=>clearInterval(t);
  },[loadConversations]);

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,maxHeight:"80vh",background:"#1e2a3a",borderRadius:"28px 28px 0 0",display:"flex",flexDirection:"column",animation:"slideUp .32s cubic-bezier(.22,1,.36,1)"}}>
        <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"10px auto 0"}}/>
        <div style={{padding:"16px 20px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{color:"#fff",fontSize:18,fontWeight:800}}>消息</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#888",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 16px 20px"}}>
          {loading?(
            <div style={{textAlign:"center",padding:"40px",color:"#555"}}>加载中...</div>
          ):conversations.length===0?(
            <div style={{textAlign:"center",padding:"50px 20px"}}>
              <div style={{fontSize:44,marginBottom:10}}>💬</div>
              <div style={{color:"#ccc",fontSize:15,fontWeight:700}}>暂无消息</div>
              <div style={{color:"#666",fontSize:13,marginTop:6}}>点击拼车的"联系TA"开始聊天</div>
            </div>
          ):conversations.map(c=>(
            <div key={c.otherId} onClick={()=>onOpenChat(c.otherId)} style={{display:"flex",gap:12,alignItems:"center",padding:"14px 8px",borderBottom:"1px solid #ffffff0d",cursor:"pointer"}}>
              <div style={{width:44,height:44,borderRadius:12,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,position:"relative"}}>
                🦊
                {c.unread>0&&<div style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:9,background:"#FF6B6B",color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{c.unread}</div>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#fff",fontSize:14,fontWeight:600}}>{c.otherId.slice(0,8)}...</div>
                <div style={{color:"#888",fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{c.lastMsg.content}</div>
              </div>
              <div style={{color:"#555",fontSize:11,flexShrink:0}}>{formatTime(c.lastMsg.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CarpoolTab;
