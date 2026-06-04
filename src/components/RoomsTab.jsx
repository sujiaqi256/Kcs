import { useState, useEffect, useCallback } from "react";
import { sb, getStoredStudentId } from "../utils";

// ─── Empty Rooms Tab ──────────────────────────────────────────────────────────
const ALL_NODES = ["第1节","第2节","第3节","第4节","第5节","第6节","第7节","第8节","第9节","第10节","第11节"];
const PERIOD_GROUPS = [
  {label:"上午", nodes:[1,2,3,4]},
  {label:"下午", nodes:[5,6,7,8]},
  {label:"晚上", nodes:[9,10,11]},
];

function RoomsTab() {
  const [bld, setBld] = useState("J1");
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const buildings = ["J1","J2","J3","J4","S1","S2","S3","S4"];

  // 生成未来14天的日期列表
  const dateList = Array.from({length: 14}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      dateStr: d.toISOString().slice(0, 10),
      month: d.getMonth() + 1,
      date: d.getDate(),
      day: ["日","一","二","三","四","五","六"][d.getDay()],
      isToday: i === 0,
    };
  });

  useEffect(() => {
    setLoading(true);
    sb(`empty_rooms?building=eq.${bld}&date=eq.${selectedDate}&order=name.asc&limit=200`)
      .then(data => {
        setRooms(data || []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [bld, selectedDate]);

  return (
    <div style={{paddingBottom:100}}>
      <div style={{background:"linear-gradient(135deg,#0f3460,#16213e)",padding:"20px 16px 14px"}}>
        <div style={{color:"#fff",fontSize:22,fontWeight:800,marginBottom:14}}>空教室查询</div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
          {buildings.map(b=>(
            <button key={b} onClick={()=>setBld(b)} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",flexShrink:0,background:bld===b?"#4DD0E1":"#ffffff22",color:"#fff",fontWeight:600,fontSize:13}}>{b}</button>
          ))}
        </div>
      </div>
      {/* 日期选择栏 */}
      <div style={{background:"#16213e",padding:"10px 16px",overflowX:"auto",display:"flex",gap:8,borderBottom:"1px solid #ffffff0d"}}>
        {dateList.map(d=>(
          <div
            key={d.dateStr}
            onClick={()=>setSelectedDate(d.dateStr)}
            style={{
              flexShrink:0,textAlign:"center",padding:"8px 12px",borderRadius:12,cursor:"pointer",
              background:selectedDate===d.dateStr?"#4DD0E1":"#ffffff11",
              border:`1px solid ${selectedDate===d.dateStr?"#4DD0E1":"transparent"}`,
            }}
          >
            <div style={{fontSize:10,color:selectedDate===d.dateStr?"#fff":"#888"}}>周{d.day}</div>
            <div style={{fontSize:14,fontWeight:700,color:selectedDate===d.dateStr?"#fff":"#ccc",marginTop:2}}>{d.date}</div>
            {d.isToday && <div style={{fontSize:9,color:selectedDate===d.dateStr?"#fff":"#4DD0E1",marginTop:1}}>今天</div>}
          </div>
        ))}
      </div>
      <div style={{padding:"10px 16px",display:"flex",gap:20,background:"#16213e",borderBottom:"1px solid #ffffff0d"}}>
        {[["#2ECC71","空闲"],["#FF6B6B","占用"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",gap:6,alignItems:"center"}}>
            <div style={{width:12,height:12,borderRadius:3,background:c}}/><span style={{color:"#aaa",fontSize:12}}>{l}</span>
          </div>
        ))}
        <span style={{color:"#555",fontSize:11,marginLeft:"auto"}}>上午·下午·晚上</span>
      </div>
      {loading ? (
        <div style={{textAlign:"center",padding:"50px",color:"#555"}}>
          <div style={{fontSize:28,animation:"spin 1s linear infinite"}}>⏳</div>
          <div style={{fontSize:12,marginTop:8}}>查询中...</div>
        </div>
      ) : rooms.length===0 ? (
        <div style={{textAlign:"center",padding:"50px",color:"#666",fontSize:14}}>暂无数据</div>
      ) : (
        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          {rooms.map((r,i)=>{
            const freePeriods = r.free_periods || [];
            const freeCount = freePeriods.length;
            return (
              <div key={r.id||i} style={{background:"#1e2a3a",borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{r.name}</div>
                  <div style={{fontSize:11,color:"#888",marginTop:2}}>今日空闲 {freeCount} 节</div>
                </div>
                <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
                  {PERIOD_GROUPS.map((grp,gi)=>(
                    <div key={gi} style={{display:"flex",gap:2,alignItems:"center"}}>
                      {gi>0&&<div style={{width:1,height:22,background:"#ffffff22",marginRight:3}}/>}
                      {grp.nodes.map((node,ni)=>{
                        const isFree = freePeriods.includes(node);
                        return <div key={ni} style={{width:7,height:22,borderRadius:3,background:isFree?"#2ECC71":"#FF6B6B",opacity:0.9}}/>;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RoomsTab;
