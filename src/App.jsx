import { useState, useEffect } from "react";
import { getStoredToken, storeAuth, clearAuth, getUser, setUser, AUTH_API } from "./utils";
import { ScheduleTab, RoomsTab, ForumTab, CarpoolTab, MarketTab, ProfileTab } from "./components";

const TABS=[
  {id:"schedule",icon:"📅",label:"课表"},
  {id:"rooms",   icon:"🏫",label:"空教室"},
  {id:"forum",   icon:"💬",label:"广场"},
  {id:"carpool", icon:"🚗",label:"拼车"},
  {id:"market",  icon:"🛍️",label:"集市"},
  {id:"profile", icon:"👤",label:"我的"},
];

export default function App(){
  const [tab,setTab]=useState("schedule");
  const [time,setTime]=useState(new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));
  const [refreshKey, setRefreshKey] = useState(0);
  const [forumRefreshKey, setForumRefreshKey] = useState(0);
  const [carpoolRefreshKey, setCarpoolRefreshKey] = useState(0);
  const [marketRefreshKey, setMarketRefreshKey] = useState(0);
  const [authValidated, setAuthValidated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleDateString('zh-CN'));
  const [netInfo, setNetInfo] = useState(()=>{try{
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const type=c?(c.type||""):"";
    const eff=c?(c.effectiveType||""):"";
    return{type,eff};
  }catch(e){return{type:"",eff:""}};});
  const [battery, setBattery] = useState({level:null,charging:false});

  useEffect(()=>{
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(!c) return;
    const update=()=>setNetInfo({type:c.type||"",eff:c.effectiveType||""});
    c.addEventListener("change",update);
    update();
    return()=>c.removeEventListener("change",update);
  },[]);

  useEffect(()=>{
    let bat=null;
    const update=()=>{if(bat)setBattery({level:Math.round(bat.level*100),charging:bat.charging});};
    navigator.getBattery().then(b=>{
      bat=b; update();
      b.addEventListener("levelchange",update);
      b.addEventListener("chargingchange",update);
    }).catch(()=>{});
    return()=>{if(bat){bat.removeEventListener("levelchange",update);bat.removeEventListener("chargingchange",update);}};
  },[]);

  useEffect(()=>{
    const token=getStoredToken();
    if(!token){ setAuthValidated(true); return; }
    fetch(`${AUTH_API}/api/user?token=${token}`)
      .then(r=>r.json())
      .then(data=>{
        if(data.ok&&data.user){
          storeAuth(token, data.user.student_id, null, null);
          setUser({id:data.user.id,student_id:data.user.student_id,nickname:data.user.nickname,avatar:data.user.avatar,...data.user});
        } else {
          clearAuth();
        }
      })
      .catch(()=>{})
      .finally(()=> setAuthValidated(true));
  },[]);

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})),10000);
    return()=>clearInterval(t);
  },[]);

  const handleSyncSchedule = () => {
    setSyncing(true);
    setTab("schedule");
    setRefreshKey(k => k + 1);
  };

  const handleManualRefreshDone = () => {
    setSyncing(false);
    setLastSyncTime(new Date().toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}));
  };

  return(
    <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:"#0d1117",fontFamily:"'PingFang SC','Noto Sans SC',sans-serif"}}>
      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(80px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{display:none;}
        input::placeholder,textarea::placeholder{color:#555;}
      `}</style>
      <div style={{background:"#1a1a2e",padding:"10px 20px 6px",display:"flex",justifyContent:"space-between"}}>
        <span style={{color:"#fff",fontSize:15,fontWeight:700}}>{time}</span>
        <div style={{display:"flex",alignItems:"center",gap:6,color:"#fff",fontSize:12}}>
          {netInfo.type==="wifi"?(<span>📶 WiFi</span>):(netInfo.eff?<span>📶 {netInfo.eff.toUpperCase()}</span>:<span>📶</span>)}
          {battery.level!==null&&<span>{battery.charging?"⚡":""}{battery.level}%</span>}
        </div>
      </div>
      <div style={{height:"calc(100vh - 118px)",overflowY:"auto"}}>
        {tab==="schedule" && authValidated && <ScheduleTab refreshKey={refreshKey} onManualRefresh={handleManualRefreshDone}/>}
        {tab==="rooms"    && <RoomsTab/>}
        {tab==="forum"    && <ForumTab refreshKey={forumRefreshKey}/>}
        {tab==="carpool"  && <CarpoolTab refreshKey={carpoolRefreshKey}/>}
        {tab==="market"   && <MarketTab refreshKey={marketRefreshKey}/>}
        {tab==="profile"  && <ProfileTab onSyncSchedule={handleSyncSchedule} lastSyncTime={lastSyncTime} syncing={syncing}/>}
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#1a1a2e",borderTop:"1px solid #ffffff0d",display:"grid",gridTemplateColumns:"repeat(6,1fr)",paddingBottom:8,zIndex:100,boxShadow:"0 -8px 32px #00000077"}}>
        {TABS.map(t=>{
          const active=tab===t.id;
          return(
            <button key={t.id} onClick={()=>{
              if(tab===t.id&&t.id==="forum"){setForumRefreshKey(k=>k+1);return;}
              if(tab===t.id&&t.id==="carpool"){setCarpoolRefreshKey(k=>k+1);return;}
              if(tab===t.id&&t.id==="market"){setMarketRefreshKey(k=>k+1);return;}
              setTab(t.id);
            }} style={{background:"none",border:"none",cursor:"pointer",padding:"10px 4px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <span style={{fontSize:20,filter:active?"none":"grayscale(.6) opacity(.45)",transform:active?"scale(1.15)":"scale(1)",transition:"transform .2s",display:"block"}}>{t.icon}</span>
              <span style={{fontSize:10,color:active?"#4DD0E1":"#555",fontWeight:active?700:400}}>{t.label}</span>
              {active&&<div style={{width:4,height:4,borderRadius:2,background:"#4DD0E1"}}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
