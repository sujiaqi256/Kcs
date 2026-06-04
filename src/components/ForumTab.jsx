import { useState, useEffect, useCallback, useRef } from "react";
import { sb, getUser, setUser, storeAuth, clearAuth, getStoredToken, AUTH_API, getCourseColor } from "../utils";

// ─── Forum Tab ────────────────────────────────────────────────────────────────
const FTAGS=["全部","学习","生活","技术","社团","美食","失物"];
const FC={学习:"#4DD0E1",生活:"#F0A500",技术:"#64B5F6",社团:"#F06292",美食:"#FF6B6B",失物:"#CE93D8"};
const AVATARS=["🦊","🐱","🐻","🐼","🦁","🐯","🐨","🐸","🦄","🐙"];

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

const PostCard=({p,i,myCount,isFav,onLike,onUnlike,onFav,onOpenDetail,longPressTimer})=>{
  return (
    <div onClick={()=>onOpenDetail(p)} style={{background:"#1e2a3a",borderRadius:18,padding:16,animation:`slideIn .3s ease ${i*.04}s both`,cursor:"pointer"}}>
      <div style={{display:"flex",gap:10}}>
        <div style={{width:40,height:40,borderRadius:12,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{p.avatar||"🦊"}</div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{color:"#fff",fontSize:13,fontWeight:700}}>{p.nickname||"匿名"}</span>
            <span style={{background:(FC[p.tag]||"#4DD0E1")+"22",color:FC[p.tag]||"#4DD0E1",border:`1px solid ${FC[p.tag]||"#4DD0E1"}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600}}>{p.tag}</span>
            <span style={{color:"#555",fontSize:11,marginLeft:"auto"}}>{formatTime(p.created_at)}</span>
          </div>
          <div style={{color:"#fff",fontSize:15,fontWeight:700,marginBottom:5}}>{p.title}</div>
          <div style={{color:"#aaa",fontSize:13,lineHeight:1.5,marginBottom:12,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.content}</div>
          <div style={{display:"flex",gap:16,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
            <button
              onClick={(e)=>{e.stopPropagation();onLike(p);}}
              onMouseDown={(e)=>{e.stopPropagation();longPressTimer.current=setTimeout(()=>onUnlike(p),500);}}
              onMouseUp={()=>{clearTimeout(longPressTimer.current);}}
              onMouseLeave={()=>{clearTimeout(longPressTimer.current);}}
              onTouchStart={(e)=>{e.stopPropagation();longPressTimer.current=setTimeout(()=>onUnlike(p),500);}}
              onTouchEnd={()=>{clearTimeout(longPressTimer.current);}}
              style={{background:"none",border:"none",cursor:"pointer",color:myCount>0?"#FF6B6B":"#888",fontSize:13,display:"flex",alignItems:"center",gap:4,userSelect:"none"}}
            >
              {myCount>0?"❤️":"🤍"} {p.likes||0}{myCount>0&&<span style={{fontSize:10,color:"#FF6B6B88"}}>({myCount})</span>}
            </button>
            <button onClick={(e)=>{e.stopPropagation();onOpenDetail(p);}} style={{background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:13,display:"flex",alignItems:"center",gap:4}}>💬 {p.comments||0}</button>
            <button onClick={(e)=>{e.stopPropagation();onFav(p);}} style={{background:"none",border:"none",cursor:"pointer",color:isFav?"#FFD54F":"#888",fontSize:13,display:"flex",alignItems:"center",gap:4,userSelect:"none"}}>
              {isFav?"⭐":"☆"} 收藏
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function LoginModal({ onClose, onLogin }) {
  const [sid,setSid]=useState("");
  const [pwd,setPwd]=useState("");
  const [showPwd,setShowPwd]=useState(false);
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const handleLogin=async()=>{
    if(!sid.trim()){setErr("请输入学号");return;}
    if(!pwd.trim()){setErr("请输入密码");return;}
    setErr(""); setLoading(true);
    try {
      const res=await fetch(`${AUTH_API}/api/login`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({student_id:sid.trim(),password:pwd.trim()})
      });
      const data=await res.json();
      if(!data.ok){setErr(data.error||"登录失败");setLoading(false);return;}
      storeAuth(data.token,data.student_id,data.auth_token,data.refresh_token);
      const u={id:data.user_id,student_id:data.student_id,nickname:data.nickname,avatar:data.avatar};
      setUser(u);
      onLogin(u);
    } catch(e){setErr("网络错误，请检查服务器是否启动");}
    setLoading(false);
  };
  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#1e2a3a",borderRadius:24,padding:28,width:"100%",maxWidth:360}}>
        <div style={{color:"#fff",fontSize:20,fontWeight:800,marginBottom:6,textAlign:"center"}}>绑定学号</div>
        <div style={{color:"#888",fontSize:13,textAlign:"center",marginBottom:20}}>登录教务系统验证身份</div>
        <input value={sid} onChange={e=>setSid(e.target.value)} placeholder="学号" maxLength={20}
          style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"12px 16px",color:"#fff",fontSize:15,outline:"none",marginBottom:10}}/>
        <div style={{position:"relative",marginBottom:8}}>
          <input value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="教务系统密码" type={showPwd?"text":"password"} maxLength={30}
            style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"12px 40px 12px 16px",color:"#fff",fontSize:15,outline:"none"}}/>
          <span onClick={()=>setShowPwd(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:16,color:"#888",userSelect:"none"}}>{showPwd?"🙈":"👁️"}</span>
        </div>
        {err&&<div style={{color:"#FF6B6B",fontSize:12,marginBottom:8}}>{err}</div>}
        <button onClick={handleLogin} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#4DD0E1,#64B5F6)",border:"none",borderRadius:16,padding:"14px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",opacity:loading?0.6:1}}>
          {loading?"验证中...":"登录验证"}
        </button>
        <div onClick={onClose} style={{textAlign:"center",marginTop:12,color:"#888",fontSize:13,cursor:"pointer"}}>稍后再说</div>
      </div>
    </div>
  );
}

function EditProfileModal({ user, onClose, onUpdated }) {
  const [nick,setNick]=useState(user.nickname||"");
  const [avatar,setAvatar]=useState(user.avatar||"🦊");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  // 检查本月改名次数
  const canChangeNick=()=>{
    const count=user.nickname_change_count||0;
    const lastChanged=user.nickname_changed_at;
    if(!lastChanged)return true;
    const last=new Date(lastChanged);
    const now=new Date();
    if(last.getFullYear()!==now.getFullYear()||last.getMonth()!==now.getMonth())return true;
    return count<6;
  };

  const getRemainingChanges=()=>{
    const count=user.nickname_change_count||0;
    const lastChanged=user.nickname_changed_at;
    if(!lastChanged)return 6;
    const last=new Date(lastChanged);
    const now=new Date();
    if(last.getFullYear()!==now.getFullYear()||last.getMonth()!==now.getMonth())return 6;
    return Math.max(0,6-count);
  };

  const handleSave=async()=>{
    if(!nick.trim()){setErr("请输入昵称");return;}
    const nickChanged=nick.trim()!==user.nickname;
    if(nickChanged&&!canChangeNick()){setErr("本月改名次数已用完（每月6次）");return;}
    setLoading(true);
    try {
      const updates={avatar};
      if(nickChanged){
        updates.nickname=nick.trim();
        updates.nickname_change_count=(user.nickname_change_count||0)+1;
        updates.nickname_changed_at=new Date().toISOString();
      }
      await sb(`users?id=eq.${user.id}`,{
        method:"PATCH",
        body:JSON.stringify(updates),
        prefer:"return=minimal"
      });
      const updated={...user,...updates};
      setUser(updated);
      onUpdated(updated);
      onClose();
    } catch(e){setErr("保存失败，请重试");}
    setLoading(false);
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",padding:"20px 20px 40px",animation:"slideUp .3s ease"}}>
        <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:16}}>编辑资料</div>
        <div style={{color:"#888",fontSize:12,marginBottom:12}}>选择头像</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginBottom:16}}>
          {AVATARS.map(a=>(
            <div key={a} onClick={()=>setAvatar(a)} style={{width:44,height:44,borderRadius:12,background:avatar===a?"#4DD0E133":"#2a3a4a",border:`2px solid ${avatar===a?"#4DD0E1":"transparent"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,cursor:"pointer"}}>{a}</div>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <span style={{color:"#888",fontSize:12}}>昵称</span>
          <span style={{color:"#555",fontSize:11}}>本月剩余改名 {getRemainingChanges()} 次</span>
        </div>
        <input value={nick} onChange={e=>setNick(e.target.value)} placeholder="输入昵称（2-10个字）" maxLength={10}
          style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff22",borderRadius:12,padding:"12px 16px",color:"#fff",fontSize:15,outline:"none",marginBottom:8}}/>
        {err&&<div style={{color:"#FF6B6B",fontSize:12,marginBottom:8}}>{err}</div>}
        <button onClick={handleSave} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#4DD0E1,#64B5F6)",border:"none",borderRadius:16,padding:"14px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",opacity:loading?0.6:1}}>
          {loading?"保存中...":"保存"}
        </button>
      </div>
    </div>
  );
}

function PostModal({ onClose, onPosted }) {
  const [title,setTitle]=useState("");
  const [content,setContent]=useState("");
  const [tag,setTag]=useState("学习");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const user=getUser();
  const handlePost=async()=>{
    if(!title.trim()){setErr("请输入标题");return;}
    if(!content.trim()){setErr("请输入内容");return;}
    setLoading(true);
    try {
      const res=await sb("posts",{method:"POST",body:JSON.stringify({user_id:user.id,nickname:user.nickname,avatar:user.avatar,tag,title:title.trim(),content:content.trim(),likes:0,comments:0})});
      onPosted(res[0]); onClose();
    } catch(e){setErr("发布失败，请重试");}
    setLoading(false);
  };
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",padding:"20px 20px 40px",animation:"slideUp .3s ease"}}>
        <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:16}}>发布帖子</div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {FTAGS.slice(1).map(t=>(
            <button key={t} onClick={()=>setTag(t)} style={{padding:"5px 14px",borderRadius:20,border:"none",cursor:"pointer",background:tag===t?(FC[t]||"#4DD0E1"):"#2a3a4a",color:"#fff",fontSize:12,fontWeight:600}}>{t}</button>
          ))}
        </div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="标题（最多30字）" maxLength={30}
          style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff11",borderRadius:12,padding:"11px 14px",color:"#fff",fontSize:14,outline:"none",marginBottom:10}}/>
        <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="内容（最多200字）" maxLength={200} rows={4}
          style={{width:"100%",background:"#2a3a4a",border:"1px solid #ffffff11",borderRadius:12,padding:"11px 14px",color:"#fff",fontSize:14,outline:"none",resize:"none",marginBottom:8}}/>
        {err&&<div style={{color:"#FF6B6B",fontSize:12,marginBottom:8}}>{err}</div>}
        <button onClick={handlePost} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#4DD0E1,#64B5F6)",border:"none",borderRadius:16,padding:"14px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",opacity:loading?0.6:1}}>
          {loading?"发布中...":"发布"}
        </button>
      </div>
    </div>
  );
}

function PostDetailModal({ post, onClose, onCommented }) {
  const [comments,setComments]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const user=getUser();
  useEffect(()=>{
    sb(`comments?post_id=eq.${post.id}&order=created_at.asc`).then(setComments).catch(()=>{});
  },[post.id]);
  const handleSend=async()=>{
    if(!input.trim()||!user) return;
    setLoading(true);
    try {
      const res=await sb("comments",{method:"POST",body:JSON.stringify({post_id:post.id,user_id:user.id,nickname:user.nickname,avatar:user.avatar,content:input.trim()})});
      setComments(c=>[...c,res[0]]); setInput("");
      const newCount = (post.comments||0)+1;
      await sb(`posts?id=eq.${post.id}`,{method:"PATCH",body:JSON.stringify({comments:newCount}),prefer:"return=minimal"});
      if(onCommented) onCommented(post.id, newCount);
    } catch(e){}
    setLoading(false);
  };
  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"#0d1117",display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}}>
      {/* 顶部导航栏 */}
      <div style={{background:"#1a1a2e",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#4DD0E1",fontSize:20,cursor:"pointer",padding:4}}>←</button>
        <span style={{color:"#fff",fontSize:16,fontWeight:700}}>帖子详情</span>
      </div>
      {/* 内容区域：可滚动 */}
      <div style={{flex:1,overflowY:"auto"}}>
        {/* 帖子内容 */}
        <div style={{padding:"16px 20px",borderBottom:"1px solid #ffffff0d"}}>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
            <div style={{width:42,height:42,borderRadius:12,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{post.avatar||"🦊"}</div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"#fff",fontSize:14,fontWeight:700}}>{post.nickname||"匿名"}</span>
                <span style={{background:(FC[post.tag]||"#4DD0E1")+"22",color:FC[post.tag]||"#4DD0E1",border:`1px solid ${FC[post.tag]||"#4DD0E1"}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600}}>{post.tag}</span>
              </div>
              <span style={{color:"#555",fontSize:11}}>{formatTime(post.created_at)}</span>
            </div>
          </div>
          <div style={{color:"#fff",fontSize:18,fontWeight:800,lineHeight:1.4,marginBottom:8}}>{post.title}</div>
          <div style={{color:"#ccc",fontSize:14,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{post.content}</div>
          <div style={{display:"flex",gap:20,marginTop:14,paddingTop:12,borderTop:"1px solid #ffffff0a"}}>
            <span style={{color:"#888",fontSize:12}}>❤️ {post.likes||0}</span>
            <span style={{color:"#888",fontSize:12}}>💬 {comments.length}</span>
          </div>
        </div>
        {/* 评论区 */}
        <div style={{padding:"16px 20px"}}>
          <div style={{color:"#aaa",fontSize:13,fontWeight:600,marginBottom:14}}>评论 {comments.length>0?`(${comments.length})`:""}</div>
          {comments.length===0&&<div style={{color:"#555",fontSize:13,textAlign:"center",padding:"30px 0"}}>暂无评论，来说点什么吧</div>}
          {comments.map((c,i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:14}}>
              <div style={{width:36,height:36,borderRadius:10,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{c.avatar||"🦊"}</div>
              <div style={{flex:1,background:"#1e2a3a",borderRadius:12,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <span style={{color:"#4DD0E1",fontSize:12,fontWeight:700}}>{c.nickname}</span>
                  <span style={{color:"#555",fontSize:10}}>{formatTime(c.created_at)}</span>
                </div>
                <div style={{color:"#ddd",fontSize:13,lineHeight:1.5}}>{c.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 底部输入框 */}
      {user?(
        <div style={{padding:"10px 16px 28px",borderTop:"1px solid #ffffff0d",background:"#1a1a2e",display:"flex",gap:10,flexShrink:0}}>
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder="说点什么..." onKeyDown={e=>e.key==="Enter"&&handleSend()}
            style={{flex:1,background:"#2a3a4a",border:"1px solid #ffffff11",borderRadius:20,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none"}}/>
          <button onClick={handleSend} disabled={loading||!input.trim()} style={{background:"#4DD0E1",border:"none",borderRadius:20,padding:"10px 16px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:loading||!input.trim()?0.5:1}}>发送</button>
        </div>
      ):(
        <div style={{padding:"12px 16px 28px",color:"#888",fontSize:13,textAlign:"center",background:"#1a1a2e",borderTop:"1px solid #ffffff0d"}}>绑定学号后才能评论</div>
      )}
    </div>
  );
}

function ForumTab({refreshKey}) {
  const [activeTag,setActiveTag]=useState("全部");
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showLogin,setShowLogin]=useState(false);
  const [showPost,setShowPost]=useState(false);
  const [detailPost,setDetailPost]=useState(null);
  const [user,setUserState]=useState(()=>getUser());
  const [searchText,setSearchText]=useState("");
  const [showSearch,setShowSearch]=useState(false);
  const [showHot,setShowHot]=useState(false);
  const [hotPosts,setHotPosts]=useState([]);
  const [showFav,setShowFav]=useState(false);
  const [favPosts,setFavPosts]=useState([]);
  const [favIds,setFavIds]=useState(new Set());
  // 每个帖子的点赞次数 { postId: count }
  const [likeCounts,setLikeCounts]=useState({});
  const longPressTimer=useRef(null);
  // 浏览历史 { postId: { post, viewedAt } }
  const [viewHistory,setViewHistory]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("kcs_view_history")||"{}");}catch(e){return{};}
  });
  const [showHistory,setShowHistory]=useState(false);
  // 下拉刷新状态
  const scrollRef=useRef(null);
  const [pullDelta,setPullDelta]=useState(0);
  const [refreshing,setRefreshing]=useState(false);
  const pullStartY=useRef(null);

  const loadPosts=useCallback(async()=>{
    setLoading(true);
    try {
      let q;
      if(searchText.trim()){
        q=`posts?or=(title.ilike.*${encodeURIComponent(searchText.trim())}*,content.ilike.*${encodeURIComponent(searchText.trim())}*)&order=created_at.desc&limit=30`;
      } else if(activeTag==="全部"){
        q="posts?order=created_at.desc&limit=30";
      } else {
        q=`posts?tag=eq.${encodeURIComponent(activeTag)}&order=created_at.desc&limit=30`;
      }
      setPosts(await sb(q)||[]);
    } catch(e){setPosts([]);}
    setLoading(false);
  },[activeTag, searchText]);

  useEffect(()=>{loadPosts();},[loadPosts]);
  // 双击广场按钮触发刷新
  useEffect(()=>{if(refreshKey>0)loadPosts();},[refreshKey]);
  // 每60秒刷新一次时间显示
  const [tick,setTick]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setTick(k=>k+1),60000);return()=>clearInterval(t);},[]);

  // 记录浏览历史
  useEffect(()=>{
    if(!detailPost) return;
    setViewHistory(h=>{
      const next={...h};
      next[detailPost.id]={post:detailPost,viewedAt:Date.now()};
      // 最多保留50条
      const keys=Object.keys(next);
      if(keys.length>50){
        const sorted=keys.sort((a,b)=>next[b].viewedAt-next[a].viewedAt);
        sorted.slice(50).forEach(k=>delete next[k]);
      }
      return next;
    });
  },[detailPost]);
  // 持久化到 localStorage
  useEffect(()=>{try{localStorage.setItem("kcs_view_history",JSON.stringify(viewHistory));}catch(e){}},[viewHistory]);

  // 加载当前用户的点赞记录和收藏记录
  useEffect(()=>{
    const u=getUser();
    if(!u) return;
    // 加载点赞记录
    sb(`post_likes?user_id=eq.${u.id}&select=post_id,count`)
      .then(data=>{
        const counts={};
        (data||[]).forEach(r=>{counts[r.post_id]=r.count||0;});
        setLikeCounts(counts);
      }).catch(()=>{});
    // 加载收藏记录
    sb(`favorites?user_id=eq.${u.id}&select=post_id`)
      .then(data=>{
        setFavIds(new Set((data||[]).map(r=>r.post_id)));
      }).catch(()=>{});
  },[user]);

  const loadHotPosts=async()=>{
    try {
      const data=await sb("posts?order=likes.desc,comments.desc&limit=20")||[];
      setHotPosts(data);
    } catch(e){}
  };

  const loadFavPosts=async()=>{
    const u=getUser();
    if(!u) return;
    try {
      const favs=await sb(`favorites?user_id=eq.${u.id}&order=created_at.desc&select=post_id`)||[];
      const ids=favs.map(f=>f.post_id);
      if(ids.length===0){setFavPosts([]);return;}
      const data=await sb(`posts?id=in.(${ids.join(",")})&order=created_at.desc`)||[];
      setFavPosts(data);
    } catch(e){}
  };

  // 每个帖子的异步操作队列，保证串行执行
  const likeQueues=useRef({});

  // 点赞：每人每帖最多10次
  const handleLike=async(post)=>{
    const u=getUser();
    if(!u){setShowLogin(true);return;}
    clearTimeout(longPressTimer.current);
    const currentCount=likeCounts[post.id]||0;
    if(currentCount>=10){alert("每帖最多点赞10次");return;}
    const newCount=currentCount+1;
    // 1. 立即更新UI（乐观更新）
    setLikeCounts(c=>({...c,[post.id]:newCount}));
    setPosts(ps=>ps.map(p=>p.id===post.id?{...p,likes:(p.likes||0)+1}:p));
    // 2. 排队写数据库（串行，避免并发竞态）
    const q=likeQueues.current[post.id]||(likeQueues.current[post.id]=Promise.resolve());
    likeQueues.current[post.id]=q.then(async()=>{
      try {
        const existing=await sb(`post_likes?user_id=eq.${u.id}&post_id=eq.${post.id}&select=id`);
        if(existing&&existing.length>0){
          await sb(`post_likes?id=eq.${existing[0].id}`,{method:"PATCH",body:JSON.stringify({count:newCount}),prefer:"return=minimal"});
        } else {
          await sb("post_likes",{method:"POST",body:JSON.stringify({user_id:u.id,post_id:post.id,count:newCount}),prefer:"return=minimal"});
        }
        const row=await sb(`posts?id=eq.${post.id}&select=likes`);
        const cur=row?.[0]?.likes||0;
        await sb(`posts?id=eq.${post.id}`,{method:"PATCH",body:JSON.stringify({likes:cur+1}),prefer:"return=minimal"});
      } catch(e){}
    });
  };

  // 长按一键取消所有赞
  const handleUnlike=async(post)=>{
    const u=getUser();
    if(!u) return;
    clearTimeout(longPressTimer.current);
    const currentCount=likeCounts[post.id]||0;
    if(currentCount<=0) return;
    // 1. 立即更新UI
    setLikeCounts(c=>({...c,[post.id]:0}));
    setPosts(ps=>ps.map(p=>p.id===post.id?{...p,likes:Math.max(0,(p.likes||0)-currentCount)}:p));
    // 2. 排队删数据库
    const q=likeQueues.current[post.id]||(likeQueues.current[post.id]=Promise.resolve());
    likeQueues.current[post.id]=q.then(async()=>{
      try {
        await sb(`post_likes?user_id=eq.${u.id}&post_id=eq.${post.id}`,{method:"DELETE",prefer:"return=minimal"});
        const row=await sb(`posts?id=eq.${post.id}&select=likes`);
        const cur=row?.[0]?.likes||0;
        await sb(`posts?id=eq.${post.id}`,{method:"PATCH",body:JSON.stringify({likes:Math.max(0,cur-currentCount)}),prefer:"return=minimal"});
      } catch(e){}
    });
  };

  // 收藏切换
  const handleFav=async(post)=>{
    const u=getUser();
    if(!u){setShowLogin(true);return;}
    const isFav=favIds.has(post.id);
    if(isFav){
      setFavIds(s=>{const n=new Set(s);n.delete(post.id);return n;});
      try{await sb(`favorites?user_id=eq.${u.id}&post_id=eq.${post.id}`,{method:"DELETE",prefer:"return=minimal"});}catch(e){
        setFavIds(s=>new Set([...s,post.id]));
      }
    } else {
      setFavIds(s=>new Set([...s,post.id]));
      try{await sb("favorites",{method:"POST",body:JSON.stringify({user_id:u.id,post_id:post.id})});}catch(e){
        setFavIds(s=>{const n=new Set(s);n.delete(post.id);return n;});
      }
    }
  };

  const handleCommented=(postId, newCount)=>{
    setPosts(ps=>ps.map(p=>p.id===postId?{...p,comments:newCount}:p));
  };

  const displayPosts=showFav?favPosts:posts;

  // 下拉刷新处理
  const handlePullStart=(e)=>{
    if(scrollRef.current&&scrollRef.current.scrollTop<=0){
      pullStartY.current=e.touches[0].clientY;
    }
  };
  const handlePullMove=(e)=>{
    if(pullStartY.current===null)return;
    const dy=e.touches[0].clientY-pullStartY.current;
    if(dy>0&&scrollRef.current&&scrollRef.current.scrollTop<=0){
      setPullDelta(Math.min(dy*0.5,120));
    }
  };
  const handlePullEnd=()=>{
    if(pullDelta>60&&!refreshing){
      setRefreshing(true);
      loadPosts().then(()=>setRefreshing(false));
    }
    setPullDelta(0);
    pullStartY.current=null;
  };

  return (
    <div style={{paddingBottom:100}}>
      {showLogin&&<LoginModal onClose={()=>setShowLogin(false)} onLogin={u=>{setUserState(u);setShowLogin(false);}}/>}
      {showPost&&<PostModal onClose={()=>setShowPost(false)} onPosted={p=>{setPosts(ps=>[p,...ps]);}}/>}
      {detailPost&&<PostDetailModal post={detailPost} onClose={()=>setDetailPost(null)} onCommented={handleCommented}/>}

      {/* 下拉刷新提示 */}
      {(pullDelta>0||refreshing)&&(
        <div style={{textAlign:"center",padding:pullDelta>0?`${Math.min(pullDelta/2,30)}px 0`:"12px 0",background:"#0d1117",transition:refreshing?"none":"none"}}>
          {refreshing?<span style={{color:"#4DD0E1",fontSize:13}}>刷新中...</span>
            :pullDelta>60?<span style={{color:"#4DD0E1",fontSize:13}}>松手刷新</span>
            :<span style={{color:"#888",fontSize:13}}>下拉刷新</span>}
        </div>
      )}

      {/* 热度排行榜弹窗 */}
      {showHot&&(
        <div onClick={()=>setShowHot(false)} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",padding:"20px 20px 40px",maxHeight:"75vh",overflowY:"auto",animation:"slideUp .3s ease"}}>
            <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:16}}>🔥 热度排行榜</div>
            {hotPosts.map((p,i)=>(
              <div key={p.id} style={{display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #ffffff0a"}}>
                <div style={{
                  width:28,height:28,borderRadius:8,flexShrink:0,
                  background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"#2a3a4a",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:i<3?"#111":"#888",fontSize:13,fontWeight:800
                }}>{i+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#fff",fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
                  <div style={{color:"#888",fontSize:11,marginTop:2}}>❤️ {p.likes||0} · 💬 {p.comments||0}</div>
                </div>
                <span style={{background:(FC[p.tag]||"#4DD0E1")+"22",color:FC[p.tag]||"#4DD0E1",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:600,flexShrink:0}}>{p.tag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 收藏夹弹窗 */}
      {showFav&&(
        <div onClick={()=>setShowFav(false)} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",padding:"20px 20px 40px",maxHeight:"75vh",overflowY:"auto",animation:"slideUp .3s ease"}}>
            <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{color:"#fff",fontSize:18,fontWeight:800,marginBottom:16}}>⭐ 我的收藏</div>
            {favPosts.length===0?(
              <div style={{color:"#555",fontSize:13,textAlign:"center",padding:"30px 0"}}>还没有收藏的帖子</div>
            ):favPosts.map((p,i)=>(
              <div key={p.id} style={{display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #ffffff0a"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#fff",fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
                  <div style={{color:"#888",fontSize:11,marginTop:2}}>❤️ {p.likes||0} · 💬 {p.comments||0}</div>
                </div>
                <span style={{background:(FC[p.tag]||"#4DD0E1")+"22",color:FC[p.tag]||"#4DD0E1",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:600,flexShrink:0}}>{p.tag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 浏览历史弹窗 */}
      {showHistory&&(
        <div onClick={()=>setShowHistory(false)} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,background:"#1e2a3a",borderRadius:"28px 28px 0 0",padding:"20px 20px 40px",maxHeight:"75vh",overflowY:"auto",animation:"slideUp .3s ease"}}>
            <div style={{width:40,height:4,background:"#ffffff22",borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <span style={{color:"#fff",fontSize:18,fontWeight:800}}>🕐 浏览历史</span>
              {Object.keys(viewHistory).length>0&&<button onClick={()=>{setViewHistory({});localStorage.removeItem("kcs_view_history");}} style={{background:"none",border:"none",color:"#FF6B6B",fontSize:12,cursor:"pointer"}}>清空</button>}
            </div>
            {Object.keys(viewHistory).length===0?(
              <div style={{color:"#555",fontSize:13,textAlign:"center",padding:"30px 0"}}>还没有浏览记录</div>
            ):Object.values(viewHistory).sort((a,b)=>b.viewedAt-a.viewedAt).map(({post:p,viewedAt})=>(
              <div key={p.id} onClick={()=>{setShowHistory(false);setDetailPost(p);}} style={{display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #ffffff0a",cursor:"pointer"}}>
                <div style={{width:36,height:36,borderRadius:10,background:"#2a3a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{p.avatar||"🦊"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#fff",fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
                  <div style={{color:"#888",fontSize:11,marginTop:2}}>
                    <span style={{background:(FC[p.tag]||"#4DD0E1")+"22",color:FC[p.tag]||"#4DD0E1",borderRadius:20,padding:"1px 6px",fontSize:10,fontWeight:600}}>{p.tag}</span>
                    <span style={{marginLeft:6}}>❤️ {p.likes||0} · 💬 {p.comments||0}</span>
                  </div>
                </div>
                <span style={{color:"#555",fontSize:10,flexShrink:0}}>{formatTime(new Date(viewedAt).toISOString())}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",padding:"20px 16px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{color:"#fff",fontSize:22,fontWeight:800}}>🦊 狐说校园</span>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setShowSearch(v=>!v);setSearchText("");}} style={{background:"#ffffff1a",border:"none",color:"#fff",padding:"8px 12px",borderRadius:20,fontSize:13,cursor:"pointer"}}>🔍</button>
            <button onClick={()=>setShowHistory(v=>!v)} style={{background:"#CE93D822",border:"1px solid #CE93D844",color:"#CE93D8",padding:"8px 12px",borderRadius:20,fontSize:13,cursor:"pointer"}}>🕐</button>
            <button onClick={()=>{setShowHot(true);loadHotPosts();}} style={{background:"#FF8A6522",border:"1px solid #FF8A6544",color:"#FF8A65",padding:"8px 12px",borderRadius:20,fontSize:13,cursor:"pointer"}}>🔥</button>
            {getUser()&&<button onClick={()=>{setShowFav(true);loadFavPosts();}} style={{background:"#FFD54F22",border:"1px solid #FFD54F44",color:"#FFD54F",padding:"8px 12px",borderRadius:20,fontSize:13,cursor:"pointer"}}>⭐</button>}
            <button onClick={()=>{if(getUser()){setShowPost(true);}else{setShowLogin(true);}}} style={{background:"#4DD0E1",border:"none",color:"#fff",padding:"8px 16px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 发帖</button>
          </div>
        </div>

        {/* 搜索框 */}
        {showSearch&&(
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input
              value={searchText}
              onChange={e=>setSearchText(e.target.value)}
              placeholder="搜索帖子标题或内容..."
              autoFocus
              style={{flex:1,background:"#ffffff15",border:"1px solid #ffffff22",borderRadius:20,padding:"8px 16px",color:"#fff",fontSize:13,outline:"none"}}
            />
            {searchText&&<button onClick={()=>setSearchText("")} style={{background:"none",border:"none",color:"#aaa",fontSize:13,cursor:"pointer"}}>✕</button>}
          </div>
        )}

        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
          {FTAGS.map(t=>(
            <button key={t} onClick={()=>{setActiveTag(t);setSearchText("");setShowFav(false);}} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",flexShrink:0,background:activeTag===t&&!searchText?(FC[t]||"#4DD0E1"):"#ffffff22",color:"#fff",fontSize:12,fontWeight:600}}>{t}</button>
          ))}
        </div>
      </div>

      {user&&(
        <div style={{background:"#16213e",padding:"8px 16px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid #ffffff0d"}}>
          <span style={{fontSize:18}}>{user.avatar}</span>
          <span style={{color:"#4DD0E1",fontSize:13,fontWeight:600}}>{user.nickname}</span>
          <span style={{color:"#555",fontSize:11,marginLeft:"auto"}}>{user.student_id?"已绑定":"游客"}</span>
        </div>
      )}

      {searchText&&(
        <div style={{background:"#16213e",padding:"8px 16px",borderBottom:"1px solid #ffffff0d"}}>
          <span style={{color:"#4DD0E1",fontSize:12}}>🔍 搜索「{searchText}」的结果</span>
        </div>
      )}

      <div ref={scrollRef} onTouchStart={handlePullStart} onTouchMove={handlePullMove} onTouchEnd={handlePullEnd} style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12,transform:pullDelta>0?`translateY(${Math.min(pullDelta/2,40)}px)`:undefined,transition:refreshing?"transform .3s":"none"}}>
        {loading?(
          <div style={{textAlign:"center",padding:"40px",color:"#555"}}>
            <div style={{fontSize:30,marginBottom:10,animation:"spin 1s linear infinite"}}>⏳</div>
            <div style={{fontSize:13}}>加载中...</div>
          </div>
        ):displayPosts.length===0?(
          <div style={{textAlign:"center",padding:"50px 20px"}}>
            <div style={{fontSize:40,marginBottom:10}}>{searchText?"🔍":showFav?"⭐":"💬"}</div>
            <div style={{color:"#ccc",fontSize:15,fontWeight:700}}>{searchText?"没有找到相关帖子":showFav?"还没有收藏":"还没有帖子"}</div>
            <div style={{color:"#666",fontSize:13,marginTop:6}}>{searchText?"换个关键词试试":showFav?"收藏帖子后在这里显示":"来发第一帖吧！"}</div>
          </div>
        ):displayPosts.map((p,i)=><PostCard key={p.id} p={p} i={i} myCount={likeCounts[p.id]||0} isFav={favIds.has(p.id)} onLike={handleLike} onUnlike={handleUnlike} onFav={handleFav} onOpenDetail={setDetailPost} longPressTimer={longPressTimer} tick={tick}/>)}
      </div>
    </div>
  );
}

export default ForumTab;
