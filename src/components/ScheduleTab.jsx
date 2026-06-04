import { useState, useEffect, useCallback, useRef } from "react";
import { sb, getStoredStudentId, getCourseColor, getSemesterStart, setSemesterStart, calcSemesterWeek, getTargetDate, DAYS, DAY_INDEX, TIME_ROWS, NODE_ROW, PERIOD_TIMES, getNodeTime, getWeekDates, getRealWeekNum } from "../utils";

function CourseModal({ item, onClose }) {
  if (!item) return null;
  const c = item;
  const clr = getCourseColor(c.name);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#fff",borderRadius:"28px 28px 0 0",paddingBottom:40,animation:"slideUp .32s cubic-bezier(.22,1,.36,1)"}}>
        <div style={{width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"10px auto 0"}}/>
        <div style={{display:"flex",gap:14,alignItems:"center",padding:"18px 22px 16px",borderBottom:"1px solid #f2f2f2"}}>
          <div style={{width:52,height:52,borderRadius:16,background:clr.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>📚</div>
          <div>
            <div style={{fontSize:17,fontWeight:800,color:"#111",lineHeight:1.3}}>{c.name}</div>
            <div style={{fontSize:12,color:clr.color,marginTop:4,fontWeight:600}}>第 {c.weeks} 周上课</div>
          </div>
        </div>
        {[
          ["📍","上课地点", c.room||""],
          ["🗓️","上课周次", `第 ${c.weeks} 周`],
          ["🕐","上课节次", `第 ${c.node} 节 · ${getNodeTime(c.node)}`],
          ["👤","任课教师", c.teacher||""],
        ].map(([icon,label,val],i,arr)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 22px",borderBottom:i<arr.length-1?"1px solid #f8f8f8":"none"}}>
            <div style={{width:40,height:40,borderRadius:12,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
            <div>
              <div style={{fontSize:11,color:"#bbb",marginBottom:2}}>{label}</div>
              <div style={{fontSize:15,fontWeight:700,color:"#222"}}>{val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekGrid({ courses, weekOffset, onWeekChange, minOffset, maxOffset, semesterStartDate, semesterWeekRange, onCourseClick }) {
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);
  const [dragDelta, setDragDelta] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionDir, setTransitionDir] = useState(0);

  const COL = 44, ROW_H = 72, TW = 46;

  const offsetToSemWeek = (wOff) => {
    if (!semesterStartDate) return semesterWeekRange.min;
    const target = new Date();
    target.setDate(target.getDate() + wOff * 7);
    return calcSemesterWeek(semesterStartDate, target);
  };

  const isInWeek = (weeksStr, semWNum) => {
    if (!weeksStr || semWNum == null) return false;
    return weeksStr.split(',').some(seg => {
      seg = seg.trim();
      const parts = seg.split('-');
      if (parts.length === 2) {
        return semWNum >= parseInt(parts[0]) && semWNum <= parseInt(parts[1]);
      }
      return parseInt(seg) === semWNum;
    });
  };

  const buildGrid = (wOffset) => {
    const semWNum = offsetToSemWeek(wOffset);
    const grid = Array.from({length:7}, () => Array(6).fill(null));
    if (semWNum < semesterWeekRange.min || semWNum > semesterWeekRange.max) return grid;
    courses.forEach(c => {
      if (isInWeek(c.weeks, semWNum)) {
        const di = DAY_INDEX[c.day];
        const ri = NODE_ROW[c.node];
        if (di !== undefined && ri !== undefined && !grid[di][ri]) {
          grid[di][ri] = c;
        }
      }
    });
    return grid;
  };

  const prevGrid = buildGrid(weekOffset - 1);
  const currGrid = buildGrid(weekOffset);
  const nextGrid = buildGrid(weekOffset + 1);

  const today = new Date();
  const todayDayOfWeek = today.getDay();

  const renderGrid = (grid, wOff) => {
    const weekDates = getWeekDates(wOff);
    const semWNum = offsetToSemWeek(wOff);
    return (
      <div style={{minWidth:TW + 7*COL + 8, flexShrink:0, width:"100%"}}>
        <div style={{display:"flex", paddingLeft:TW, marginBottom:6}}>
          {DAYS.map((d,i)=>{
            const wd = weekDates[i];
            const isToday = wOff === 0 && i === todayDayOfWeek;
            return (
              <div key={i} style={{width:COL,textAlign:"center",flexShrink:0}}>
                <div style={{fontSize:10,color:"#777"}}>周{d}</div>
                <div style={{
                  width:26,height:26,borderRadius:9,
                  margin:"3px auto 0",
                  background: isToday ? "#4DD0E1" : "transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:700,
                  color: isToday ? "#fff" : "#bbb"
                }}>{wd.date}</div>
              </div>
            );
          })}
        </div>
        {TIME_ROWS.map((tr,rowIdx)=>{
          const hasSpan = rowIdx === 4 && grid.some(dayCol => dayCol[4] && dayCol[4].node === "9-11");
          const isSpanRow = rowIdx === 5 && grid.some(dayCol => dayCol[4] && dayCol[4].node === "9-11");
          const rowH = hasSpan ? ROW_H * 2 + 3 : isSpanRow ? 0 : ROW_H;
          return (
          <div key={rowIdx} style={{display:"flex",marginBottom:3,alignItems:"stretch",height:rowH}}>
            <div style={{width:TW,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"center",paddingRight:6,gap:1}}>
              <span style={{fontSize:9,color:"#4DD0E1",fontWeight:700}}>{tr.start}</span>
              <span style={{fontSize:8,color:"#555"}}>节{tr.label}</span>
              <span style={{fontSize:9,color:"#555"}}>{tr.end}</span>
            </div>
            {grid.map((dayCol,di)=>{
              const cell = dayCol[rowIdx];
              const isSpan = cell && cell.node === "9-11" && rowIdx === 4;
              const isHidden = rowIdx === 5 && dayCol[4] && dayCol[4].node === "9-11";
              const cellH = isSpan ? ROW_H * 2 + 3 : rowH;
              return (
                <div key={di} style={{width:COL,height:cellH,flexShrink:0,padding:"0 2px",position:"relative"}}>
                  {isHidden ? null : cell ? (
                    <div
                      onClick={()=>onCourseClick(cell)}
                      style={{
                        height:"100%",borderRadius:11,
                        background:getCourseColor(cell.name).color+"2e",
                        borderLeft:`3px solid ${getCourseColor(cell.name).color}`,
                        padding:"5px 4px 4px",cursor:"pointer",overflow:"hidden",
                        display:"flex",flexDirection:"column",justifyContent:"space-between"
                      }}
                    >
                      <div style={{fontSize:9.5,fontWeight:700,color:"#fff",lineHeight:1.3,wordBreak:"break-all"}}>{cell.name.slice(0,9)}</div>
                      <div style={{fontSize:8.5,color:getCourseColor(cell.name).color,lineHeight:1.2,marginTop:2}}>@{cell.room}</div>
                    </div>
                  ) : (
                    <div style={{height:"100%",borderRadius:10,background:"#1c2535"}}/>
                  )}
                </div>
              );
            })}
          </div>
          );
        })}
      </div>
    );
  };

  const canGoPrev = weekOffset - 1 >= minOffset;
  const canGoNext = weekOffset + 1 <= maxOffset;

  const handleTouchStart = (e) => {
    if (transitioning) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
    setDragDelta(0);
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - (touchStartY.current ?? e.touches[0].clientY));
    if (touchStartY.current !== null && dy > Math.abs(dx) && Math.abs(dx) < 20) {
      isDragging.current = false;
      return;
    }
    e.preventDefault();
    const clamped = Math.max(-200, Math.min(200, dx));
    setDragDelta(clamped);
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    touchStartY.current = null;
    const threshold = 60;
    if (dragDelta < -threshold && canGoNext) {
      setTransitionDir(-1);
      setTransitioning(true);
      setTimeout(() => {
        onWeekChange(weekOffset + 1);
        setTransitioning(false);
        setDragDelta(0);
        setTransitionDir(0);
      }, 280);
    } else if (dragDelta > threshold && canGoPrev) {
      setTransitionDir(1);
      setTransitioning(true);
      setTimeout(() => {
        onWeekChange(weekOffset - 1);
        setTransitioning(false);
        setDragDelta(0);
        setTransitionDir(0);
      }, 280);
    } else {
      setDragDelta(0);
    }
  };

  const w = containerRef.current?.offsetWidth || 414;
  let prevX = -w, currX = 0, nextX = w;

  if (transitioning) {
    if (transitionDir === -1) { prevX = -2*w; currX = -w; nextX = 0; }
    else                       { prevX = 0;   currX = w;  nextX = 2*w; }
  } else {
    prevX = -w + dragDelta;
    currX = 0 + dragDelta;
    nextX = w + dragDelta;
  }

  const transStyle = transitioning
    ? "transform .28s cubic-bezier(.4,0,.2,1)"
    : "none";

  return (
    <div
      ref={containerRef}
      style={{background:"#0d1117", overflow:"hidden", padding:"8px 0 4px", position:"relative", touchAction:"pan-y"}}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{position:"relative", height: TIME_ROWS.length * (ROW_H + 3) + 54}}>
        <div style={{
          position:"absolute", top:0, left:0, right:0,
          padding:"0 8px",
          transform:`translateX(${prevX}px)`,
          transition:transStyle,
          opacity: canGoPrev ? 1 : 0.2,
        }}>
          {renderGrid(prevGrid, weekOffset - 1)}
        </div>
        <div style={{
          position:"absolute", top:0, left:0, right:0,
          padding:"0 8px",
          transform:`translateX(${currX}px)`,
          transition:transStyle,
        }}>
          {renderGrid(currGrid, weekOffset)}
        </div>
        <div style={{
          position:"absolute", top:0, left:0, right:0,
          padding:"0 8px",
          transform:`translateX(${nextX}px)`,
          transition:transStyle,
          opacity: canGoNext ? 1 : 0.2,
        }}>
          {renderGrid(nextGrid, weekOffset + 1)}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:5,paddingTop:6,paddingBottom:2}}>
        {!canGoPrev && <span style={{color:"#333",fontSize:10}}>← 已是第一周</span>}
        {canGoPrev && <span style={{color:"#555",fontSize:10}}>← 左滑上一周</span>}
        <span style={{color:"#4DD0E1",fontSize:10,fontWeight:700}}>第{offsetToSemWeek(weekOffset)}周</span>
        {canGoNext && <span style={{color:"#555",fontSize:10}}>右滑下一周 →</span>}
        {!canGoNext && <span style={{color:"#333",fontSize:10}}>已是最后一周 →</span>}
      </div>
    </div>
  );
}

export default function ScheduleTab({ refreshKey, onManualRefresh }) {
  const [weekView, setWeekView] = useState(false);
  const yearWeekNow = getRealWeekNum();
  const todayDayOfWeek = new Date().getDay();
  const [weekOffset, setWeekOffset] = useState(0);
  const [semesterWeekRange, setSemesterWeekRange] = useState({ min: 1, max: 20 });
  const [semesterStartDate, setSemesterStartDate] = useState(() => getSemesterStart());

  const displaySemesterWeek = semesterStartDate
    ? calcSemesterWeek(semesterStartDate, getTargetDate(weekOffset))
    : null;
  const displayYearWeek = yearWeekNow + weekOffset;

  const [selDay, setSelDay] = useState(todayDayOfWeek);
  const [modal, setModal] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates(weekOffset);
  const now = new Date();
  const targetDate = getTargetDate(weekOffset);
  const monthStr = `${targetDate.getFullYear()}年${targetDate.getMonth()+1}月`;

  const loadCourses = useCallback(() => {
    setLoading(true);
    const sid = getStoredStudentId();
    if (!sid) {
      setCourses([]);
      setLoading(false);
      return Promise.resolve();
    }
    const query = `schedule?student_id=eq.${encodeURIComponent(sid)}&order=day.asc,node.asc&limit=500`;
    return sb(query)
      .then(data => {
        const normalized = (data || []).map(item => ({
          ...item,
          weeks: item.weeks != null ? String(item.weeks) : "",
          day:   item.day   != null ? String(item.day)   : "",
          node:  item.node  != null ? String(item.node)  : "",
        }));
        setCourses(normalized);

        let minSem = Infinity, maxSem = 0;
        normalized.forEach(item => {
          if (!item.weeks) return;
          const parts = item.weeks.split("-").map(n => parseInt(n, 10)).filter(n => !isNaN(n));
          if (parts.length === 2) { minSem = Math.min(minSem, parts[0]); maxSem = Math.max(maxSem, parts[1]); }
          else if (parts.length === 1) { minSem = Math.min(minSem, parts[0]); maxSem = Math.max(maxSem, parts[0]); }
        });
        if (minSem === Infinity || maxSem === 0) { minSem = 1; maxSem = 20; }
        setSemesterWeekRange({ min: minSem, max: maxSem });

        const storedStart = getSemesterStart();
        if (normalized.length > 0) {
          const startDates = normalized
            .map(c => c.start_date)
            .filter(Boolean)
            .sort();
          if (startDates.length > 0) {
            const earliest = new Date(startDates[0]);
            const day = earliest.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            earliest.setDate(earliest.getDate() + diff);
            const dateStr = earliest.toISOString().slice(0, 10);
            setSemesterStart(dateStr);
            setSemesterStartDate(new Date(dateStr));
          } else if (!storedStart) {
            const dateStr = "2026-03-02";
            setSemesterStart(dateStr);
            setSemesterStartDate(new Date(dateStr));
          }
        }

        setLoading(false);
        onManualRefresh?.();
      })
      .catch(err => {
        console.error("加载课程失败:", err);
        setLoading(false);
        onManualRefresh?.();
      });
  }, [refreshKey]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const isInWeek = (weeksStr, semWeek) => {
    if (!weeksStr || semWeek == null) return false;
    return weeksStr.split(',').some(seg => {
      seg = seg.trim();
      const parts = seg.split('-');
      if (parts.length === 2) {
        return semWeek >= parseInt(parts[0]) && semWeek <= parseInt(parts[1]);
      }
      return parseInt(seg) === semWeek;
    });
  };

  const dayCourses = courses.filter(c =>
    DAY_INDEX[c.day] === selDay && isInWeek(c.weeks, displaySemesterWeek)
  );

  const handleWeekChange = (newOffset) => { setWeekOffset(newOffset); };
  const handleDayClick = (i) => { setSelDay(i); setWeekView(false); };

  let minOffset = -30, maxOffset = 30;
  if (semesterStartDate) {
    for (let o = -30; o <= 30; o++) {
      const sw = calcSemesterWeek(semesterStartDate, getTargetDate(o));
      if (sw !== null && sw >= semesterWeekRange.min) { minOffset = o; break; }
    }
    for (let o = 30; o >= -30; o--) {
      const sw = calcSemesterWeek(semesterStartDate, getTargetDate(o));
      if (sw !== null && sw <= semesterWeekRange.max) { maxOffset = o; break; }
    }
  }

  return (
    <div style={{paddingBottom:100}}>
      <CourseModal item={modal} onClose={()=>setModal(null)}/>
      <div style={{background:"linear-gradient(160deg,#1a1a2e 0%,#16213e 100%)",padding:"18px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button
              onClick={()=>setWeekOffset(o=>Math.max(o-1, minOffset))}
              style={{background:"#ffffff22",border:"1px solid #ffffff22",color:"#4DD0E1",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:14}}
            >‹</button>
            <div style={{textAlign:"center",minWidth:72}}>
              <div style={{color:"#fff",fontSize:22,fontWeight:800,letterSpacing:-0.5,lineHeight:1}}>
                第{displaySemesterWeek >= semesterWeekRange.min && displaySemesterWeek <= semesterWeekRange.max ? displaySemesterWeek : "?"}周
              </div>
              <div style={{color:"#4DD0E188",fontSize:10,marginTop:2}}>
                年内第{displayYearWeek}周
              </div>
            </div>
            <button
              onClick={()=>setWeekOffset(o=>Math.min(o+1, 20))}
              style={{background:"#ffffff22",border:"1px solid #ffffff22",color:"#4DD0E1",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:14}}
            >›</button>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {weekOffset !== 0 && (
              <button
                onClick={()=>{ setWeekOffset(0); setSelDay(todayDayOfWeek); }}
                style={{background:"#FF8A6522",border:"1px solid #FF8A6544",borderRadius:20,padding:"5px 11px",color:"#FF8A65",fontSize:11,fontWeight:700,cursor:"pointer"}}
              >回今天</button>
            )}
            <span style={{color:"#4DD0E1",fontSize:12,background:"#4DD0E118",padding:"4px 11px",borderRadius:20,border:"1px solid #4DD0E133"}}>{monthStr}</span>
            <button
              onClick={()=>setWeekView(v=>!v)}
              style={{background:weekView?"#4DD0E1":"#ffffff1a",border:"1px solid "+(weekView?"#4DD0E1":"#ffffff22"),borderRadius:20,padding:"5px 13px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}
            >{weekView?"📋 日视图":"🗓️ 周视图"}</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,paddingBottom:weekView?14:0}}>
          {DAYS.map((d,i)=>{
            const isToday = i === todayDayOfWeek && weekOffset === 0;
            const isSel = i === selDay && !weekView;
            const wd = weekDates[i];
            return (
              <div
                key={i}
                onClick={()=>handleDayClick(i)}
                style={{
                  textAlign:"center",padding:"8px 0",borderRadius:13,cursor:"pointer",
                  background: isSel ? (isToday ? "#4DD0E1" : "#ffffff20") : "transparent"
                }}
              >
                <div style={{fontSize:10,color:isSel?"#fff":"#777"}}>周{d}</div>
                <div style={{fontSize:13,fontWeight:700,color:isSel?"#fff":"#ccc",marginTop:2}}>{wd.date}</div>
                {isToday && !isSel && <div style={{width:4,height:4,background:"#4DD0E1",borderRadius:"50%",margin:"3px auto 0"}}/>}
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:"60px",color:"#555"}}>
          <div style={{fontSize:30,marginBottom:10,animation:"spin 1s linear infinite"}}>⏳</div>
          <div style={{fontSize:13}}>加载课表中...</div>
        </div>
      ) : weekView ? (
        <WeekGrid
          courses={courses}
          weekOffset={weekOffset}
          onWeekChange={handleWeekChange}
          minOffset={minOffset}
          maxOffset={maxOffset}
          semesterStartDate={semesterStartDate}
          semesterWeekRange={semesterWeekRange}
          onCourseClick={setModal}
        />
      ) : (
        <>
          <div style={{background:"#16213e",padding:"10px 16px",borderBottom:"1px solid #ffffff0d"}}>
            <span style={{color:"#4DD0E1",fontSize:13,fontWeight:600}}>
              {selDay === todayDayOfWeek && weekOffset === 0 ? "📅 今天 · " : ""}
              {weekDates[selDay].month}/{weekDates[selDay].date} · {dayCourses.length} 门课
            </span>
          </div>
          <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
            {dayCourses.length === 0 ? (
              <div style={{textAlign:"center",padding:"56px 20px"}}>
                <div style={{fontSize:44,marginBottom:10}}>🎉</div>
                <div style={{color:"#ccc",fontSize:16,fontWeight:700}}>这天没有课</div>
                <div style={{fontSize:13,color:"#666",marginTop:6}}>好好休息或自习吧～</div>
              </div>
            ) : dayCourses.map((c,i)=>{
              const clr = getCourseColor(c.name);
              return (
                <div
                  key={i}
                  onClick={()=>setModal(c)}
                  style={{
                    background:"#1e2a3a",borderRadius:18,padding:"14px 16px",
                    borderLeft:`4px solid ${clr.color}`,
                    display:"flex",alignItems:"center",gap:14,cursor:"pointer",
                    boxShadow:`0 4px 20px ${clr.color}1a`,
                    animation:`slideIn .3s ease ${i*.08}s both`
                  }}
                >
                  <div style={{width:48,height:48,borderRadius:14,background:clr.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📖</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:6,lineHeight:1.3}}>{c.name}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span style={{background:clr.color+"22",color:clr.color,border:`1px solid ${clr.color}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600}}>🏫 {c.room}</span>
                      <span style={{background:"#ffffff0d",color:"#999",borderRadius:20,padding:"2px 10px",fontSize:11}}>🕐 {c.node}节 · {getNodeTime(c.node)}</span>
                    </div>
                  </div>
                  <span style={{color:"#444",fontSize:18}}>›</span>
                </div>
              );
            })}
          </div>
          <div style={{padding:"0 16px 16px"}}>
            <div style={{background:"#1e2a3a",borderRadius:16,padding:16}}>
              <div style={{color:"#aaa",fontSize:12,marginBottom:10,fontWeight:600}}>📋 节次时间表</div>
              {PERIOD_TIMES.map((t,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #ffffff08"}}>
                  <span style={{color:"#4DD0E1",fontSize:12,fontWeight:600}}>{t.label}</span>
                  <span style={{color:"#ccc",fontSize:12}}>{t.start} — {t.end}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
