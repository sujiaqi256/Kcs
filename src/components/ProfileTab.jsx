import { useState, useEffect } from "react";
import { sb, getStoredStudentId, getCourseColor, getUser, setUser as setUserGlobal, storeAuth, clearAuth, AUTH_API, getRealWeekNum, getStoredToken } from "../utils";

function LoginModal({ onClose, onLogin }) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!studentId.trim() || !password.trim()) {
      setError("请输入学号和密码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        storeAuth(data.token, data.student_id, data.auth_token, data.refresh_token);
        const user = { id: data.user_id, student_id: data.student_id, nickname: data.nickname, avatar: data.avatar };
        setUserGlobal(user);
        onLogin(user);
      } else {
        setError(data.error || "登录失败");
      }
    } catch (e) {
      setError("网络错误，请重试");
    }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#0d1117",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px"}}>
        <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:20}}>绑定学号</div>
        <div style={{marginBottom:12}}>
          <div style={{color:"#888",fontSize:12,marginBottom:6}}>学号</div>
          <input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="请输入10-12位学号" style={{width:"100%",background:"#1a2332",border:"1px solid #ffffff22",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,outline:"none"}}/>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{color:"#888",fontSize:12,marginBottom:6}}>教务系统密码</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="请输入密码" style={{width:"100%",background:"#1a2332",border:"1px solid #ffffff22",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,outline:"none"}}/>
        </div>
        {error && <div style={{color:"#FF6B6B",fontSize:12,marginBottom:12}}>{error}</div>}
        <button onClick={handleLogin} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#4DD0E1,#64B5F6)",border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",opacity:loading?0.6:1}}>
          {loading ? "登录中..." : "登录并同步课表"}
        </button>
        <div style={{color:"#555",fontSize:11,textAlign:"center",marginTop:12}}>密码仅用于教务系统验证，不会存储</div>
      </div>
    </div>
  );
}

function EditProfileModal({ user, onClose, onUpdated }) {
  const [nickname, setNickname] = useState(user.nickname || "");
  const [avatar, setAvatar] = useState(user.avatar || "🦊");
  const [loading, setLoading] = useState(false);
  const AVATARS = ["🦊","🐱","🐻","🐼","🦁","🐯","🐨","🐸","🦄","🐙"];

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await sb(`users?id=eq.${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nickname: nickname.trim(), avatar }),
        prefer: "return=minimal",
      });
      const updated = { ...user, nickname: nickname.trim(), avatar };
      setUserGlobal(updated);
      onUpdated(updated);
      onClose();
    } catch (e) {
      alert("保存失败");
    }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#0d1117",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px"}}>
        <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:20}}>编辑资料</div>
        <div style={{marginBottom:16}}>
          <div style={{color:"#888",fontSize:12,marginBottom:8}}>选择头像</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {AVATARS.map(a => (
              <div key={a} onClick={() => setAvatar(a)} style={{width:44,height:44,borderRadius:12,background:avatar===a?"#4DD0E133":"#1a2332",border:avatar===a?"2px solid #4DD0E1":"2px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,cursor:"pointer"}}>{a}</div>
            ))}
          </div>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{color:"#888",fontSize:12,marginBottom:6}}>昵称</div>
          <input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={12} style={{width:"100%",background:"#1a2332",border:"1px solid #ffffff22",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,outline:"none"}}/>
        </div>
        <button onClick={handleSave} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#4DD0E1,#64B5F6)",border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",opacity:loading?0.6:1}}>
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

function CourseListModal({ onClose }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    const sid = getStoredStudentId();
    if (!sid) {
      setCourses([]);
      setLoading(false);
      return;
    }
    const query = `schedule?student_id=eq.${encodeURIComponent(sid)}&order=day.asc,node.asc&limit=500`;
    sb(query)
      .then(data => {
        const normalized = (data || []).map(item => ({
          ...item,
          weeks: item.weeks != null ? String(item.weeks) : "",
          day: item.day != null ? String(item.day) : "",
          node: item.node != null ? String(item.node) : "",
        }));
        const seen = new Set();
        const unique = normalized.filter(c => {
          const key = `${c.name}_${c.teacher}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setCourses(unique);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  });

  const dayNames = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const nodeLabels = ["", "第1-2节", "第3-4节", "第5-6节", "第7-8节", "第9-10节", "第11-12节"];

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,maxHeight:"85vh",background:"#0d1117",borderRadius:"20px 20px 0 0",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #ffffff0d"}}>
          <div style={{color:"#fff",fontSize:18,fontWeight:800}}>课程列表</div>
          <div onClick={onClose} style={{color:"#888",fontSize:22,cursor:"pointer",padding:"0 4px"}}>✕</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {loading ? (
            <div style={{textAlign:"center",padding:40,color:"#888"}}>加载中...</div>
          ) : courses.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#888"}}>暂无课程数据</div>
          ) : (
            courses.map((c, i) => {
              const clr = getCourseColor(c.name);
              return (
                <div key={i} style={{background:"#1a2332",borderRadius:14,padding:"14px 16px",marginBottom:10,borderLeft:`3px solid ${clr.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{color:"#fff",fontSize:15,fontWeight:700,lineHeight:1.4}}>{c.name}</div>
                      <div style={{color:"#aaa",fontSize:12,marginTop:4}}>👤 {c.teacher || "未知教师"}</div>
                      <div style={{color:"#aaa",fontSize:12,marginTop:2}}>📍 {c.room || "未知教室"}</div>
                      <div style={{color:"#aaa",fontSize:12,marginTop:2}}>
                        🕐 {dayNames[c.day] || `周${c.day}`} {nodeLabels[c.node] || `第${c.node}节`}
                      </div>
                      {c.weeks && <div style={{color:"#aaa",fontSize:12,marginTop:2}}>📅 第{c.weeks}周</div>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function GradeQueryModal({ onClose }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState("all");

  useEffect(() => {
    const sid = getStoredStudentId();
    if (!sid) {
      setError("请先登录并绑定学号");
      setLoading(false);
      return;
    }
    sb(`grades?student_id=eq.${encodeURIComponent(sid)}&order=term.desc`)
      .then(data => {
        if (!data || data.length === 0) {
          setError("暂无成绩数据，请登录后同步");
        } else {
          setGrades(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("成绩查询失败，请稍后再试");
        setLoading(false);
      });
  }, []);

  const terms = [...new Set(grades.map(g => g.term).filter(Boolean))];
  const filtered = selectedTerm === "all" ? grades : grades.filter(g => g.term === selectedTerm);

  const calcSummary = (list) => {
    let totalCredit = 0, weightedSum = 0;
    list.forEach(g => {
      const credit = parseFloat(g.credit) || 0;
      const score = parseFloat(g.score) || 0;
      totalCredit += credit;
      weightedSum += credit * score;
    });
    return {
      count: list.length,
      totalCredit: totalCredit.toFixed(1),
      avg: totalCredit > 0 ? (weightedSum / totalCredit).toFixed(1) : "-",
    };
  };

  const summary = calcSummary(filtered);
  const allSummary = calcSummary(grades);

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,maxHeight:"85vh",background:"#0d1117",borderRadius:"20px 20px 0 0",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #ffffff0d"}}>
          <div style={{color:"#fff",fontSize:18,fontWeight:800}}>成绩查询</div>
          <div onClick={onClose} style={{color:"#888",fontSize:22,cursor:"pointer",padding:"0 4px"}}>✕</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {loading ? (
            <div style={{textAlign:"center",padding:40,color:"#888"}}>加载中...</div>
          ) : error ? (
            <div style={{textAlign:"center",padding:40}}>
              <div style={{fontSize:48,marginBottom:16}}>📊</div>
              <div style={{color:"#888",fontSize:14,lineHeight:1.6}}>{error}</div>
            </div>
          ) : (
            <>
              {/* 学期选择 */}
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:12,marginBottom:12,borderBottom:"1px solid #ffffff11"}}>
                <button onClick={()=>setSelectedTerm("all")} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:"none",background:selectedTerm==="all"?"#667eea":"#1a1f2e",color:selectedTerm==="all"?"#fff":"#888",fontSize:13,cursor:"pointer"}}>全部</button>
                {terms.map(t => (
                  <button key={t} onClick={()=>setSelectedTerm(t)} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:"none",background:selectedTerm===t?"#667eea":"#1a1f2e",color:selectedTerm===t?"#fff":"#888",fontSize:13,cursor:"pointer"}}>{t}</button>
                ))}
              </div>

              {/* 汇总 */}
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {[
                  {label:`${summary.count}门`,color:"#667eea"},
                  {label:`均分 ${summary.avg}`,color:"#f093fb"},
                  {label:`总学分 ${summary.totalCredit}`,color:"#4facfe"},
                ].map((s,i) => (
                  <div key={i} style={{flex:1,textAlign:"center",background:"#1a1f2e",borderRadius:12,padding:"10px 4px"}}>
                    <div style={{color:s.color,fontSize:16,fontWeight:700}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* 成绩列表 */}
              {filtered.map((g, i) => {
                const score = parseFloat(g.score);
                const scoreColor = isNaN(score) ? "#888" : score >= 90 ? "#4facfe" : score >= 80 ? "#43e97b" : score >= 60 ? "#f9d423" : "#FF6B6B";
                return (
                  <div key={i} style={{background:"#1a1f2e",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{color:"#fff",fontSize:14,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.name}</div>
                      <div style={{color:scoreColor,fontSize:20,fontWeight:800,marginLeft:12}}>{g.score || "-"}</div>
                    </div>
                    <div style={{display:"flex",gap:12,fontSize:12,color:"#888"}}>
                      <span>学分: {g.credit || "-"}</span>
                      <span>GPA: {g.gpa || "-"}</span>
                      {g.term && <span style={{marginLeft:"auto",color:"#666"}}>{g.term}</span>}
                    </div>
                  </div>
                );
              })}

              {/* 总汇总 */}
              {selectedTerm !== "all" && grades.length > 0 && (
                <div style={{marginTop:12,padding:"12px 14px",background:"#1a1f2e",borderRadius:12,border:"1px solid #667eea44"}}>
                  <div style={{color:"#888",fontSize:12,marginBottom:8}}>全部学期汇总</div>
                  <div style={{display:"flex",gap:16,fontSize:14}}>
                    <span style={{color:"#fff"}}>{allSummary.count} 门课程</span>
                    <span style={{color:"#f093fb"}}>均分 {allSummary.avg}</span>
                    <span style={{color:"#4facfe"}}>总学分 {allSummary.totalCredit}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CourseSelectionModal({ onClose, type, onReLogin }) {
  const isPublic = type === "public";
  const courseType = isPublic ? "gx" : "bx";
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectingId, setSelectingId] = useState(null);
  const [selectResult, setSelectResult] = useState(null);
  const [error, setError] = useState("");

  const fetchCourses = async (kw) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_API}/api/available-courses`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({token: getStoredToken(), course_type: courseType, keyword: kw || ""})
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("__relogin__");
      } else if (data.ok) {
        setCourses(data.courses || []);
      } else {
        setError(data.error || "加载失败");
      }
    } catch (e) {
      setError("网络错误，请重试");
    }
    setLoading(false);
  };

  useEffect(() => { fetchCourses(""); }, []);

  const handleSelect = async (courseId) => {
    setSelectingId(courseId);
    try {
      const res = await fetch(`${AUTH_API}/api/select-course`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({token: getStoredToken(), course_id: courseId, course_type: courseType})
      });
      const data = await res.json();
      if (res.status === 401) {
        setSelectResult({courseId, success: false, message: "会话已过期"});
        setTimeout(() => { setSelectResult(null); onReLogin && onReLogin(); }, 1500);
      } else {
        setSelectResult({courseId, success: data.ok, message: data.message || (data.ok ? "选课成功" : "选课失败")});
        if (data.ok && !data.already_selected) fetchCourses(keyword);
        setTimeout(() => setSelectResult(null), 2500);
      }
    } catch (e) {
      setSelectResult({courseId, success: false, message: "网络错误"});
      setTimeout(() => setSelectResult(null), 2500);
    }
    setSelectingId(null);
  };

  const toInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,maxHeight:"85vh",background:"#0d1117",borderRadius:"20px 20px 0 0",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #ffffff0d"}}>
          <div style={{color:"#fff",fontSize:18,fontWeight:800}}>{isPublic ? "公选课选课" : "必修课选课"}</div>
          <div onClick={onClose} style={{color:"#888",fontSize:22,cursor:"pointer",padding:"0 4px"}}>✕</div>
        </div>
        <div style={{padding:"10px 16px"}}>
          <input value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")fetchCourses(keyword);}} placeholder="搜索课程名/教师..." style={{width:"100%",padding:"10px 12px",background:"#1a2332",border:"1px solid #ffffff15",borderRadius:10,color:"#fff",fontSize:14,outline:"none"}} />
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 16px 16px"}}>
          {error === "__relogin__" ? (
            <div style={{textAlign:"center",padding:40}}>
              <div style={{color:"#FF6B6B",fontSize:14,marginBottom:12}}>教务系统会话已过期</div>
              <button onClick={()=>{onClose();onReLogin&&onReLogin();}} style={{background:"linear-gradient(135deg,#667eea,#764ba2)",border:"none",borderRadius:10,padding:"10px 24px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>重新登录</button>
            </div>
          ) : error ? (
            <div style={{textAlign:"center",padding:40}}>
              <div style={{color:"#FF6B6B",fontSize:14,marginBottom:8}}>{error}</div>
              <div onClick={()=>fetchCourses(keyword)} style={{color:"#667eea",fontSize:13,cursor:"pointer",marginTop:8}}>点击重试</div>
            </div>
          ) : loading ? (
            <div style={{textAlign:"center",padding:40,color:"#888",fontSize:14}}>加载中...</div>
          ) : courses.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#888",fontSize:14}}>暂无可选课程</div>
          ) : courses.map((c, i) => {
            const cap = toInt(c.capacity);
            const sel = toInt(c.selected);
            const rem = toInt(c.remaining);
            const ratio = cap > 0 ? sel / cap : 0;
            const isFull = cap > 0 && rem <= 0;
            const result = selectResult && selectResult.courseId === c.id;
            return (
              <div key={c.id || i} style={{background:"#1a2332",borderRadius:14,padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:"#fff",fontSize:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                    <div style={{color:"#aaa",fontSize:12,marginTop:4}}>{c.teacher} {c.credit && c.credit !== "-" ? `| ${c.credit}学分` : ""} {c.hours && c.hours !== "-" ? `| ${c.hours}学时` : ""}</div>
                  </div>
                  <button disabled={selectingId === c.id || isFull} onClick={()=>handleSelect(c.id)} style={{flexShrink:0,background: isFull ? "#333" : (selectingId === c.id ? "#555" : "linear-gradient(135deg,#4ade80,#22c55e)"),border:"none",borderRadius:8,padding:"8px 14px",color: isFull ? "#666" : "#fff",fontSize:13,fontWeight:600,cursor: isFull ? "default" : "pointer",opacity: selectingId === c.id ? 0.7 : 1}}>
                    {selectingId === c.id ? "选课中..." : (isFull ? "已满" : "选课")}
                  </button>
                </div>
                {cap > 0 && (
                  <div style={{marginTop:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888",marginBottom:4}}>
                      <span>已选 {sel}/{cap}</span>
                      <span>剩余 {rem} 人</span>
                    </div>
                    <div style={{height:4,background:"#ffffff10",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(ratio*100,100)}%`,background: ratio > 0.9 ? "#FF6B6B" : (ratio > 0.7 ? "#fbbf24" : "#4ade80"),borderRadius:2,transition:"width 0.3s"}} />
                    </div>
                  </div>
                )}
                {result && (
                  <div style={{marginTop:8,padding:"6px 10px",borderRadius:8,background: selectResult.success ? "#22c55e22" : "#FF6B6B22",color: selectResult.success ? "#4ade80" : "#FF6B6B",fontSize:12,fontWeight:600}}>
                    {selectResult.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CourseSelectionSystemModal({ onClose, type }) {
  const isPublic = type === "public";
  const [tab, setTab] = useState("browse");
  const [courses, setCourses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectingId, setSelectingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [myCourses, setMyCourses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [windows, setWindows] = useState([]);
  const [stats, setStats] = useState(null);
  const [autoGrabId, setAutoGrabId] = useState(null);
  const [autoGrabMsg, setAutoGrabMsg] = useState("");
  const [studentInfo, setStudentInfo] = useState(null);
  const studentId = getStoredStudentId();

  const showToast = (msg, ok) => { setToast({msg, ok}); setTimeout(() => setToast(null), 2500); };

  const fetchCourses = async (kw, p, dept, silent) => {
    if (!silent) { setLoading(true); setError(""); }
    try {
      const params = new URLSearchParams({page: String(p || 1), size: "20"});
      if (kw) params.set("keyword", kw);
      if (dept) params.set("department", dept);
      const res = await fetch(`${AUTH_API}/api/ss/courses?${params}`);
      const data = await res.json();
      if (data.ok) { setCourses(data.courses || []); setTotal(data.total || 0); setDepartments(data.departments || []); }
      else setError(data.error || "加载失败");
    } catch (e) { setError("网络错误"); }
    if (!silent) setLoading(false);
  };

  const fetchWindows = async () => {
    try { const res = await fetch(`${AUTH_API}/api/ss/windows`); const data = await res.json(); setWindows(data.windows || []); } catch(e) {}
  };

  const fetchStudentInfo = async () => {
    if (!studentId) return;
    try { const res = await fetch(`${AUTH_API}/api/ss/student-info?student_id=${studentId}`); const data = await res.json(); if (data.ok) setStudentInfo(data); } catch(e) {}
  };

  useEffect(() => { fetchCourses("", 1, ""); fetchWindows(); fetchStudentInfo(); }, []);
  useEffect(() => { if (tab === "selected" && studentId) fetchMyCourses(); if (tab === "logs" && studentId) fetchLogs(); if (tab === "stats") fetchStats(); }, [tab]);

  // 实时刷新：每5秒静默更新课程列表和学生信息
  useEffect(() => {
    const timer = setInterval(() => {
      fetchCourses(keyword, page, deptFilter, true);
      fetchStudentInfo();
      fetchWindows();
    }, 5000);
    return () => clearInterval(timer);
  }, [keyword, page, deptFilter]);

  const fetchMyCourses = async () => {
    try { const res = await fetch(`${AUTH_API}/api/ss/my-selections?student_id=${studentId}`); const data = await res.json(); setMyCourses(data.courses || []); } catch(e) {}
  };
  const fetchLogs = async () => {
    try { const res = await fetch(`${AUTH_API}/api/ss/logs?student_id=${studentId}&limit=50`); const data = await res.json(); setLogs(data.logs || []); } catch(e) {}
  };
  const fetchStats = async () => {
    try { const res = await fetch(`${AUTH_API}/api/ss/stats`); const data = await res.json(); setStats(data); } catch(e) {}
  };

  const handleSelect = async (courseId) => {
    // 先检查冲突
    try {
      const cr = await fetch(`${AUTH_API}/api/ss/check-conflict`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({student_id:studentId, course_id:courseId})});
      const cd = await cr.json();
      if (cd.has_conflict) {
        const names = cd.conflicts.map(c => c.name).join("、");
        showToast(`与已选课程冲突：${names}`, false);
        return;
      }
    } catch(e) {}
    // 检查选课上限
    if (studentInfo && studentInfo.selected_count >= studentInfo.max_courses) {
      showToast(`已达到最大选课数 ${studentInfo.max_courses} 门`, false);
      return;
    }
    setSelectingId(courseId);
    try {
      const res = await fetch(`${AUTH_API}/api/ss/select`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({student_id:studentId, course_id:courseId})});
      const data = await res.json();
      showToast(data.message, data.ok);
      if (data.ok) { fetchCourses(keyword, page, deptFilter); fetchMyCourses(); fetchStudentInfo(); }
    } catch (e) { showToast("网络错误", false); }
    setSelectingId(null);
  };

  const handleDrop = async (courseId) => {
    try {
      const res = await fetch(`${AUTH_API}/api/ss/drop`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({student_id:studentId, course_id:courseId})});
      const data = await res.json();
      showToast(data.message, data.ok);
      if (data.ok) { fetchMyCourses(); fetchCourses(keyword, page, deptFilter); }
    } catch (e) { showToast("网络错误", false); }
  };

  const startAutoGrab = (courseId) => {
    if (autoGrabId) { clearInterval(window.__autoGrabTimer); setAutoGrabId(null); setAutoGrabMsg(""); return; }
    setAutoGrabId(courseId);
    setAutoGrabMsg("正在抢课...");
    let count = 0;
    window.__autoGrabTimer = setInterval(async () => {
      count++;
      try {
        const res = await fetch(`${AUTH_API}/api/ss/auto-grab`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({student_id:studentId, course_id:courseId})});
        const data = await res.json();
        setAutoGrabMsg(`第${count}次尝试: ${data.message}`);
        if (!data.continue) {
          clearInterval(window.__autoGrabTimer);
          setAutoGrabId(null);
          showToast(data.message, data.ok);
          if (data.ok) { fetchCourses(keyword, page, deptFilter); fetchMyCourses(); }
        }
      } catch (e) { setAutoGrabMsg(`第${count}次: 网络错误，继续重试...`); }
    }, 3000);
  };

  useEffect(() => { return () => { if (window.__autoGrabTimer) clearInterval(window.__autoGrabTimer); }; }, []);

  const toInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

  const exportCSV = () => {
    if (!myCourses.length) return;
    var lines = ["Code,Name,Teacher,Credit,Schedule,Location,Time"];
    myCourses.forEach(function(c) {
      lines.push([c.course_code, c.name, c.teacher, c.credit, c.schedule||"", c.location||"", c.selected_at ? new Date(c.selected_at).toLocaleString("zh-CN") : ""].join(","));
    });
    var blob = new Blob([lines.join("\n")], {type:"text/csv"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "courses_" + studentId + ".csv";
    a.click();
    showToast("Exported", true);
  };

  const totalPages = Math.ceil(total / 20);
  const tabStyle = (t) => ({flex:1,padding:"8px 0",textAlign:"center",fontSize:13,fontWeight:tab===t?700:500,color:tab===t?"#4DD0E1":"#888",borderBottom:tab===t?"2px solid #4DD0E1":"2px solid transparent",cursor:"pointer",transition:"all 0.2s"});

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,maxHeight:"90vh",background:"#0d1117",borderRadius:"20px 20px 0 0",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {toast && <div style={{position:"absolute",top:60,left:"50%",transform:"translateX(-50%)",zIndex:10,padding:"8px 20px",borderRadius:10,background:toast.ok?"#22c55e22":"#FF6B6B22",color:toast.ok?"#4ade80":"#FF6B6B",fontSize:13,fontWeight:600,backdropFilter:"blur(10px)",border:`1px solid ${toast.ok?"#22c55e44":"#FF6B6B44"}`}}>{toast.msg}</div>}
        <div style={{padding:"16px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{color:"#fff",fontSize:18,fontWeight:800}}>选课系统</div>
          <div onClick={onClose} style={{color:"#888",fontSize:22,cursor:"pointer",padding:"0 4px"}}>✕</div>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #ffffff0d",marginTop:8}}>
          <div onClick={()=>setTab("browse")} style={tabStyle("browse")}>浏览课程</div>
          <div onClick={()=>setTab("selected")} style={tabStyle("selected")}>已选课程</div>
          <div onClick={()=>setTab("logs")} style={tabStyle("logs")}>操作日志</div>
          <div onClick={()=>setTab("stats")} style={tabStyle("stats")}>统计</div>
        </div>
        {(() => {
          const openWin = windows.find(w => w.status === "open");
          const upcomingWin = windows.find(w => w.status === "upcoming");
          if (openWin) {
            return <div style={{margin:"8px 16px 0",padding:"8px 12px",borderRadius:10,background:"#22c55e15",border:"1px solid #22c55e33",color:"#4ade80",fontSize:12}}>
              <span style={{fontWeight:700}}>选课已开放</span> — {openWin.name || "当前窗口"}
              {openWin.end_time && <span style={{marginLeft:8,opacity:0.7}}>截止 {new Date(openWin.end_time).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>}
            </div>;
          }
          if (upcomingWin) {
            return <div style={{margin:"8px 16px 0",padding:"8px 12px",borderRadius:10,background:"#fbbf2415",border:"1px solid #fbbf2433",color:"#fbbf24",fontSize:12}}>
              <span style={{fontWeight:700}}>选课即将开放</span> — {upcomingWin.name || ""}
              {upcomingWin.start_time && <span style={{marginLeft:8}}>开始 {new Date(upcomingWin.start_time).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>}
            </div>;
          }
          return null;
        })()}
        {tab === "browse" && (
          <>
            <div style={{padding:"10px 16px",display:"flex",gap:8}}>
              <input value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setPage(1);fetchCourses(keyword,1,deptFilter);}}} placeholder="搜索课程名/教师/编号..." style={{flex:1,padding:"10px 12px",background:"#1a2332",border:"1px solid #ffffff15",borderRadius:10,color:"#fff",fontSize:14,outline:"none"}} />
              <select value={deptFilter} onChange={e=>{setDeptFilter(e.target.value);setPage(1);fetchCourses(keyword,1,e.target.value);}} style={{padding:"10px 8px",background:"#1a2332",border:"1px solid #ffffff15",borderRadius:10,color:"#fff",fontSize:12,outline:"none",minWidth:80}}>
                <option value="">全部</option>
                {departments.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"0 16px 16px"}}>
              {loading ? <div style={{textAlign:"center",padding:40,color:"#888"}}>加载中...</div>
              : error ? <div style={{textAlign:"center",padding:40}}><div style={{color:"#FF6B6B",fontSize:14}}>{error}</div><div onClick={()=>fetchCourses(keyword,page,deptFilter)} style={{color:"#667eea",fontSize:13,cursor:"pointer",marginTop:8}}>重试</div></div>
              : courses.length === 0 ? <div style={{textAlign:"center",padding:40,color:"#888"}}>暂无课程</div>
              : <>
                {courses.map(c => {
                  const cap=c.max_capacity, sel=c.selected, ratio=cap>0?sel/cap:0, isFull=sel>=cap, isGrabbing=autoGrabId===c.id;
                  return (
                    <div key={c.id} style={{background:"#1a2332",borderRadius:14,padding:14,marginBottom:10,opacity:isFull&& !isGrabbing?0.7:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{color:"#4DD0E1",fontSize:11,background:"#4DD0E122",padding:"2px 6px",borderRadius:4}}>{c.course_code}</span>
                            <span style={{color:"#fff",fontSize:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                          </div>
                          <div style={{color:"#aaa",fontSize:12,marginTop:4}}>{c.teacher} | {c.credit}学分 | {c.hours}学时</div>
                          {c.schedule && <div style={{color:"#666",fontSize:11,marginTop:2}}>{c.schedule} {c.location ? `@ ${c.location}` : ""}</div>}
                          {c.department && <div style={{color:"#555",fontSize:11,marginTop:1}}>{c.department}</div>}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                          <button disabled={selectingId===c.id} onClick={()=>handleSelect(c.id)} style={{background:isFull?"#333":(selectingId===c.id?"#555":"linear-gradient(135deg,#4ade80,#22c55e)"),border:"none",borderRadius:8,padding:"8px 14px",color:isFull?"#666":"#fff",fontSize:13,fontWeight:600,cursor:isFull?"default":"pointer"}}>
                            {selectingId===c.id?"选课中...":(isFull?"已满":"选课")}
                          </button>
                          {isFull && <button onClick={()=>startAutoGrab(c.id)} style={{background:isGrabbing?"linear-gradient(135deg,#FF6B6B,#ef4444)":"#ffffff10",border:"1px solid #ffffff15",borderRadius:8,padding:"6px 10px",color:isGrabbing?"#fff":"#fbbf24",fontSize:11,fontWeight:600,cursor:"pointer"}}>{isGrabbing?"停止抢课":"自动抢课"}</button>}
                        </div>
                      </div>
                      <div style={{marginTop:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888",marginBottom:4}}>
                          <span>已选 {sel}/{cap}</span><span>{isFull?"已满":`剩余 ${cap-sel} 人`}</span>
                        </div>
                        <div style={{height:4,background:"#ffffff10",borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.min(ratio*100,100)}%`,background:ratio>0.9?"#FF6B6B":(ratio>0.7?"#fbbf24":"#4ade80"),borderRadius:2,transition:"width 0.3s"}} />
                        </div>
                      </div>
                      {isGrabbing && autoGrabMsg && <div style={{marginTop:6,padding:"6px 10px",borderRadius:8,background:"#fbbf2422",color:"#fbbf24",fontSize:11}}>{autoGrabMsg}</div>}
                    </div>
                  );
                })}
                {totalPages > 1 && (
                  <div style={{display:"flex",justifyContent:"center",gap:12,alignItems:"center",padding:"8px 0"}}>
                    <button disabled={page<=1} onClick={()=>{setPage(page-1);fetchCourses(keyword,page-1,deptFilter);}} style={{background:"#1a2332",border:"1px solid #ffffff15",borderRadius:8,padding:"6px 14px",color:page<=1?"#444":"#fff",fontSize:12,cursor:page<=1?"default":"pointer"}}>上一页</button>
                    <span style={{color:"#888",fontSize:12}}>{page}/{totalPages}</span>
                    <button disabled={page>=totalPages} onClick={()=>{setPage(page+1);fetchCourses(keyword,page+1,deptFilter);}} style={{background:"#1a2332",border:"1px solid #ffffff15",borderRadius:8,padding:"6px 14px",color:page>=totalPages?"#444":"#fff",fontSize:12,cursor:page>=totalPages?"default":"pointer"}}>下一页</button>
                  </div>
                )}
              </>}
            </div>
          </>
        )}
        {tab === "selected" && (
          <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
            {!studentId ? <div style={{textAlign:"center",padding:40,color:"#888"}}>请先登录</div>
            : <div>
              {studentInfo && <div style={{background:"#1a2332",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{color:"#fff",fontSize:13,fontWeight:600}}>{studentInfo.name || studentId}</span>
                  <span style={{color:studentInfo.selected_count >= studentInfo.max_courses ? "#FF6B6B" : "#4ade80", fontSize:13, fontWeight:600, marginLeft:8}}>
                    已选 {studentInfo.selected_count}/{studentInfo.max_courses} 门
                  </span>
                </div>
                <button onClick={exportCSV} style={{background:"#4DD0E122",border:"1px solid #4DD0E144",borderRadius:8,padding:"6px 12px",color:"#4DD0E1",fontSize:12,fontWeight:600,cursor:"pointer"}}>导出选课</button>
              </div>}
              {myCourses.length === 0 ? <div style={{textAlign:"center",padding:40,color:"#888"}}>暂未选课</div>
            : myCourses.map(c => (
              <div key={c.id} style={{background:"#1a2332",borderRadius:14,padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:"#4DD0E1",fontSize:11,background:"#4DD0E122",padding:"2px 6px",borderRadius:4}}>{c.course_code}</span>
                      <span style={{color:"#fff",fontSize:15,fontWeight:700}}>{c.name}</span>
                    </div>
                    <div style={{color:"#aaa",fontSize:12,marginTop:4}}>{c.teacher} | {c.credit}学分</div>
                    {c.schedule && <div style={{color:"#666",fontSize:11,marginTop:2}}>{c.schedule}</div>}
                    {c.selected_at && <div style={{color:"#555",fontSize:11,marginTop:2}}>选课时间: {new Date(c.selected_at).toLocaleString("zh-CN")}</div>}
                  </div>
                  <button onClick={()=>handleDrop(c.id)} style={{background:"#FF6B6B22",border:"1px solid #FF6B6B44",borderRadius:8,padding:"8px 14px",color:"#FF6B6B",fontSize:12,fontWeight:600,cursor:"pointer"}}>退课</button>
                </div>
              </div>
            ))}
            </div>}
          </div>
        )}
        {tab === "logs" && (
          <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
            {!studentId ? <div style={{textAlign:"center",padding:40,color:"#888"}}>请先登录</div>
            : logs.length === 0 ? <div style={{textAlign:"center",padding:40,color:"#888"}}>暂无操作记录</div>
            : logs.map((l,i) => (
              <div key={i} style={{background:"#1a2332",borderRadius:10,padding:12,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:l.result==="success"?"#4ade80":(l.result==="full"?"#fbbf24":"#FF6B6B"),fontSize:13,fontWeight:600}}>
                    {l.action==="select"?"选课":(l.action==="drop"?"退课":"抢课")}
                  </span>
                  <span style={{color:"#555",fontSize:11}}>{new Date(l.created_at).toLocaleString("zh-CN")}</span>
                </div>
                <div style={{color:"#aaa",fontSize:12,marginTop:4}}>{l.message}</div>
                {l.ip_address && <div style={{color:"#444",fontSize:10,marginTop:2}}>IP: {l.ip_address}</div>}
              </div>
            ))}
          </div>
        )}
        {tab === "stats" && (
          <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
            {!stats ? <div style={{textAlign:"center",padding:40,color:"#888"}}>加载中...</div> : (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                  <div style={{background:"#1a2332",borderRadius:14,padding:16,textAlign:"center"}}>
                    <div style={{color:"#4DD0E1",fontSize:28,fontWeight:800}}>{stats.total_courses}</div>
                    <div style={{color:"#888",fontSize:12,marginTop:4}}>课程总数</div>
                  </div>
                  <div style={{background:"#1a2332",borderRadius:14,padding:16,textAlign:"center"}}>
                    <div style={{color:"#4ade80",fontSize:28,fontWeight:800}}>{stats.total_selections}</div>
                    <div style={{color:"#888",fontSize:12,marginTop:4}}>选课人次</div>
                  </div>
                </div>
                <div style={{color:"#fff",fontSize:14,fontWeight:700,marginBottom:10}}>各学院选课统计</div>
                {(stats.department_stats||[]).map(d => (
                  <div key={d.department} style={{background:"#1a2332",borderRadius:10,padding:12,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
                      <span style={{color:"#fff",fontWeight:600}}>{d.department}</span>
                      <span style={{color:"#888"}}>{d.course_count}门课</span>
                    </div>
                    <div style={{height:4,background:"#ffffff10",borderRadius:2,overflow:"hidden",marginTop:6}}>
                      <div style={{height:"100%",width:`${d.total_capacity>0?Math.min(d.total_selected/d.total_capacity*100,100):0}%`,background:"#4DD0E1",borderRadius:2}} />
                    </div>
                    <div style={{color:"#888",fontSize:11,marginTop:4}}>已选 {d.total_selected}/{d.total_capacity}</div>
                  </div>
                ))}
                <div style={{color:"#fff",fontSize:14,fontWeight:700,margin:"16px 0 10px"}}>热门课程 TOP5</div>
                {(stats.top_courses||[]).map((c,i) => (
                  <div key={i} style={{background:"#1a2332",borderRadius:10,padding:12,marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:24,height:24,borderRadius:8,background:i<3?"linear-gradient(135deg,#fbbf24,#f59e0b)":"#333",display:"flex",alignItems:"center",justifyContent:"center",color:i<3?"#000":"#888",fontSize:12,fontWeight:700}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{color:"#fff",fontSize:13,fontWeight:600}}>{c.name}</div>
                      <div style={{color:"#888",fontSize:11}}>{c.teacher} | {c.selected}/{c.max_capacity}人</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AboutModal({ onClose }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,maxHeight:"85vh",background:"#0d1117",borderRadius:"20px 20px 0 0",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #ffffff0d"}}>
          <div style={{color:"#fff",fontSize:18,fontWeight:800}}>关于</div>
          <div onClick={onClose} style={{color:"#888",fontSize:22,cursor:"pointer",padding:"0 4px"}}>✕</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"24px 16px",textAlign:"center"}}>
          <div style={{width:80,height:80,borderRadius:20,margin:"0 auto 16px",background:"linear-gradient(135deg,#4DD0E1,#64B5F6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,boxShadow:"0 8px 24px #4DD0E144"}}>🦊</div>
          <div style={{color:"#fff",fontSize:22,fontWeight:800,marginBottom:4}}>Kcs 校园助手</div>
          <div style={{color:"#888",fontSize:13,marginBottom:24}}>版本 2.3.0</div>
          <div style={{background:"#1a2332",borderRadius:14,padding:"16px",textAlign:"left",marginBottom:16}}>
            {[
              ["📅", "智能课表", "自动同步教务系统课程"],
              ["🏫", "空教室查询", "实时查看空闲教室"],
              ["💬", "校园广场", "校园社交互动平台"],
              ["🚗", "拼车出行", "校内拼车信息共享"],
              ["🛍️", "二手集市", "闲置物品交易平台"],
            ].map(([icon, title, desc], i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<4?"1px solid #ffffff0a":"none"}}>
                <div style={{fontSize:20}}>{icon}</div>
                <div>
                  <div style={{color:"#fff",fontSize:13,fontWeight:600}}>{title}</div>
                  <div style={{color:"#888",fontSize:11,marginTop:2}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{color:"#555",fontSize:11,lineHeight:1.6}}>
            © 2026 Kcs 校园助手<br/>Powered by Supabase + React
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfileTab({ onSyncSchedule, lastSyncTime, syncing }){
  const [showLogin,setShowLogin]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [showCourseList,setShowCourseList]=useState(false);
  const [showGradeQuery,setShowGradeQuery]=useState(false);
  const [showCourseSelection,setShowCourseSelection]=useState(null);
  const [showAbout,setShowAbout]=useState(false);
  const [user,setUserState]=useState(()=>getUser());

  const handleLogout=()=>{
    clearAuth();
    setUserGlobal(null);
    setUserState(null);
  };

  const handleClearCache=()=>{
    try{
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach(c=>{
        const name=c.split("=")[0].trim();
        if(name!=="kcs_token") document.cookie=name+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
      alert("缓存已清除");
      window.location.reload();
    }catch(e){
      alert("清除失败："+e.message);
    }
  };

  const menu=[
    ...(user ? [{icon:"✏️",label:"编辑资料",sub:"修改昵称和头像",action:()=>setShowEdit(true)}] : []),
    {icon:"📋",label:"课程列表",sub:"本学期课程",action:()=>setShowCourseList(true)},
    {icon:"📊",label:"成绩查询",sub:"查看学期成绩",action:()=>setShowGradeQuery(true)},
    {icon:"🔄",label:"课表更新",sub:syncing?"同步中...":`上次同步 ${lastSyncTime}`,action:onSyncSchedule,highlight:true},
    {icon:"🎓",label:"公选课选课",sub:"点击进入",action:()=>setShowCourseSelection("public")},
    {icon:"📚",label:"必修课选课",sub:"点击进入",action:()=>setShowCourseSelection("required")},
    {icon:"🗑️",label:"清除缓存",sub:"",action:handleClearCache},
    {icon:"ℹ️",label:"关于",sub:"版本 2.3.0",action:()=>setShowAbout(true)},
  ];

  return(
    <div style={{paddingBottom:100}}>
      {showLogin&&<LoginModal onClose={()=>setShowLogin(false)} onLogin={u=>{setUserState(u);setShowLogin(false);}}/>}
      {showEdit&&user&&<EditProfileModal user={user} onClose={()=>setShowEdit(false)} onUpdated={u=>setUserState(u)}/>}
      {showCourseList&&<CourseListModal onClose={()=>setShowCourseList(false)}/>}
      {showGradeQuery&&<GradeQueryModal onClose={()=>setShowGradeQuery(false)}/>}
      {showCourseSelection==="public"&&<CourseSelectionModal type="public" onClose={()=>setShowCourseSelection(null)} onReLogin={()=>{setShowCourseSelection(null);setShowLogin(true);}}/>}
      {showCourseSelection==="required"&&<CourseSelectionSystemModal type="required" onClose={()=>setShowCourseSelection(null)}/>}
      {showAbout&&<AboutModal onClose={()=>setShowAbout(false)}/>}
      <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",padding:"30px 16px 24px",textAlign:"center"}}>
        <div style={{width:80,height:80,borderRadius:24,background:"linear-gradient(135deg,#4DD0E1,#64B5F6)",margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,boxShadow:"0 8px 24px #4DD0E144"}}>{user?.avatar||"🦊"}</div>
        {user?(
          <>
            <div style={{color:"#fff",fontSize:20,fontWeight:800}}>{user.nickname||"同学"}</div>
            <div style={{color:"#aaa",fontSize:13,marginTop:4}}>学号 {user.student_id||"未绑定"}</div>
          </>
        ):(
          <>
            <div style={{color:"#fff",fontSize:20,fontWeight:800}}>未登录</div>
            <div style={{color:"#aaa",fontSize:13,marginTop:4}}>绑定学号解锁更多功能</div>
            <button onClick={()=>setShowLogin(true)} style={{marginTop:12,background:"linear-gradient(135deg,#4DD0E1,#64B5F6)",border:"none",borderRadius:20,padding:"10px 28px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>绑定学号</button>
          </>
        )}
        <div style={{display:"flex",justifyContent:"center",gap:24,marginTop:16}}>
          {[["17","门课程"],[getRealWeekNum().toString(),"学周"],["2026","年"]].map(([val,label])=>(
            <div key={label} style={{textAlign:"center"}}>
              <div style={{color:"#4DD0E1",fontSize:20,fontWeight:800}}>{val}</div>
              <div style={{color:"#888",fontSize:11}}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"16px"}}>
        <div style={{background:"#1e2a3a",borderRadius:18,overflow:"hidden"}}>
          {menu.map((item,i)=>(
            <div key={i} onClick={item.action} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:i<menu.length-1?"1px solid #ffffff0a":"none",cursor:item.action?"pointer":"default",background:item.action&&item.highlight?"#4DD0E108":"transparent"}}>
              <div style={{width:36,height:36,borderRadius:10,background:item.highlight?"#4DD0E122":"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,animation:syncing&&item.highlight?"spin 1s linear infinite":"none"}}>{item.icon}</div>
              <div style={{flex:1}}>
                <div style={{color:item.highlight?"#4DD0E1":"#fff",fontSize:14,fontWeight:600}}>{item.label}</div>
                {item.sub&&<div style={{color:syncing&&item.highlight?"#4DD0E1":"#888",fontSize:11,marginTop:2}}>{item.sub}</div>}
              </div>
              {item.highlight?(
                <span style={{color:"#4DD0E1",fontSize:12,fontWeight:600}}>{syncing?"同步中":"立即更新"}</span>
              ):(
                <span style={{color:"#555",fontSize:16}}>›</span>
              )}
            </div>
          ))}
        </div>
        {user&&(
          <button onClick={handleLogout} style={{width:"100%",marginTop:12,background:"#FF6B6B22",border:"1px solid #FF6B6B44",borderRadius:16,padding:"12px",color:"#FF6B6B",fontSize:14,fontWeight:600,cursor:"pointer"}}>退出登录</button>
        )}
        <div style={{marginTop:16}}>
          <div style={{color:"#aaa",fontSize:12,fontWeight:600,marginBottom:10}}>快捷服务</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[["🚌","客运服务"],["🔧","线上报修"],["🐺","狐友圈子"],["🚲","哈啰单车"],["🏥","校医院"],["📮","校园邮局"]].map(([icon,label])=>(
              <div key={label} style={{background:"#1e2a3a",borderRadius:14,padding:"14px 8px",textAlign:"center",cursor:"pointer"}}>
                <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
                <div style={{color:"#ccc",fontSize:11}}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
