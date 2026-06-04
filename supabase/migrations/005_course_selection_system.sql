-- ============================================================
-- 选课系统数据库 — 数据库课期末大作业
-- 包含：表结构、索引、触发器、示例数据
-- ============================================================

-- 1. 课程信息表
CREATE TABLE IF NOT EXISTS cs_courses (
    id          BIGSERIAL PRIMARY KEY,
    course_code VARCHAR(20)  NOT NULL UNIQUE,   -- 课程编号
    name        VARCHAR(100) NOT NULL,           -- 课程名称
    teacher     VARCHAR(50)  NOT NULL,           -- 授课教师
    credit      NUMERIC(3,1) NOT NULL,           -- 学分
    hours       INTEGER      NOT NULL DEFAULT 32,-- 学时
    max_capacity INTEGER     NOT NULL DEFAULT 60,-- 最大容量
    selected    INTEGER      NOT NULL DEFAULT 0, -- 已选人数
    department  VARCHAR(50)  DEFAULT '',          -- 开课学院
    description TEXT         DEFAULT '',          -- 课程简介
    schedule    VARCHAR(100) DEFAULT '',          -- 上课时间（如 "周一1-2节"）
    location    VARCHAR(100) DEFAULT '',          -- 上课地点
    status      VARCHAR(20)  DEFAULT 'active',   -- active/closed/full
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- 2. 选课窗口表
CREATE TABLE IF NOT EXISTS cs_time_windows (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,           -- 窗口名称
    start_time  TIMESTAMPTZ  NOT NULL,           -- 开放时间
    end_time    TIMESTAMPTZ  NOT NULL,           -- 结束时间
    course_type VARCHAR(20)  DEFAULT 'required', -- required/optional
    is_active   BOOLEAN      DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- 3. 选课记录表
CREATE TABLE IF NOT EXISTS cs_selections (
    id          BIGSERIAL PRIMARY KEY,
    student_id  VARCHAR(20)  NOT NULL,           -- 学号
    course_id   BIGINT       NOT NULL REFERENCES cs_courses(id),
    status      VARCHAR(20)  DEFAULT 'selected', -- selected/dropped/waitlist
    selected_at TIMESTAMPTZ  DEFAULT NOW(),
    dropped_at  TIMESTAMPTZ,
    UNIQUE(student_id, course_id)
);

-- 4. 选课日志表（记录每次操作）
CREATE TABLE IF NOT EXISTS cs_selection_logs (
    id          BIGSERIAL PRIMARY KEY,
    student_id  VARCHAR(20)  NOT NULL,
    course_id   BIGINT       NOT NULL REFERENCES cs_courses(id),
    action      VARCHAR(20)  NOT NULL,           -- select/drop/auto_grab
    result      VARCHAR(20)  NOT NULL,           -- success/fail/already/full/conflict/not_open
    message     TEXT         DEFAULT '',
    ip_address  VARCHAR(45)  DEFAULT '',
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- 5. 学生信息表（独立于 users 表，用于选课系统）
CREATE TABLE IF NOT EXISTS cs_students (
    id          BIGSERIAL PRIMARY KEY,
    student_id  VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(50)  NOT NULL,
    department  VARCHAR(50)  DEFAULT '',
    grade       VARCHAR(20)  DEFAULT '',          -- 年级
    max_courses INTEGER      DEFAULT 5,           -- 最大选课数
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- 索引
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_cs_courses_status ON cs_courses(status);
CREATE INDEX IF NOT EXISTS idx_cs_courses_department ON cs_courses(department);
CREATE INDEX IF NOT EXISTS idx_cs_courses_name ON cs_courses USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cs_selections_student ON cs_selections(student_id);
CREATE INDEX IF NOT EXISTS idx_cs_selections_course ON cs_selections(course_id);
CREATE INDEX IF NOT EXISTS idx_cs_logs_student ON cs_selection_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_cs_logs_created ON cs_selection_logs(created_at);

-- ============================================================
-- 触发器：更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_cs_courses_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cs_courses_updated ON cs_courses;
CREATE TRIGGER trg_cs_courses_updated
    BEFORE UPDATE ON cs_courses
    FOR EACH ROW
    EXECUTE FUNCTION update_cs_courses_timestamp();

-- ============================================================
-- 触发器：选课时自动更新 selected 计数
-- ============================================================
CREATE OR REPLACE FUNCTION update_cs_courses_selected()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'selected' THEN
        UPDATE cs_courses SET selected = selected + 1 WHERE id = NEW.course_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'selected' AND NEW.status = 'dropped' THEN
        UPDATE cs_courses SET selected = selected - 1 WHERE id = NEW.course_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cs_selections_count ON cs_selections;
CREATE TRIGGER trg_cs_selections_count
    AFTER INSERT OR UPDATE ON cs_selections
    FOR EACH ROW
    EXECUTE FUNCTION update_cs_courses_selected();

-- ============================================================
-- 示例数据：课程
-- ============================================================
INSERT INTO cs_courses (course_code, name, teacher, credit, hours, max_capacity, selected, department, description, schedule, location) VALUES
-- 计算机学院
('CS101', '数据结构与算法', '张明华', 4.0, 64, 60, 45, '计算机学院', '讲授常用数据结构（栈、队列、树、图）及经典算法设计与分析', '周一3-4节 周三3-4节', '致用楼301'),
('CS102', '操作系统原理', '李建国', 3.5, 56, 55, 52, '计算机学院', '进程管理、内存管理、文件系统、I/O系统', '周二5-6节 周四5-6节', '致用楼302'),
('CS103', '计算机网络', '王秀英', 3.5, 56, 60, 38, '计算机学院', 'OSI七层模型、TCP/IP协议族、网络安全基础', '周一1-2节 周三1-2节', '致用楼201'),
('CS104', '数据库系统原理', '赵丽娟', 4.0, 64, 55, 55, '计算机学院', '关系模型、SQL语言、事务处理、索引与优化', '周二1-2节 周四1-2节', '致用楼303'),
('CS105', '软件工程', '刘伟', 3.0, 48, 50, 30, '计算机学院', '软件开发流程、需求分析、设计模式、项目管理', '周五3-4节', '致用楼202'),
('CS106', '编译原理', '陈志强', 3.0, 48, 45, 22, '计算机学院', '词法分析、语法分析、语义分析、代码生成', '周三5-6节 周五5-6节', '致用楼304'),
('CS107', '人工智能导论', '黄晓峰', 3.0, 48, 60, 58, '计算机学院', '搜索算法、机器学习基础、神经网络入门', '周一7-8节 周三7-8节', '致用楼205'),
('CS108', 'Web前端开发', '林小红', 3.0, 48, 50, 41, '计算机学院', 'HTML/CSS/JavaScript、Vue.js框架实战', '周二7-8节 周四7-8节', '实验楼B201'),

-- 电子信息学院
('EE101', '电路分析基础', '孙国栋', 3.5, 56, 55, 35, '电子信息学院', '电路基本定律、暂态分析、正弦稳态分析', '周一3-4节 周三3-4节', '致远楼101'),
('EE102', '模拟电子技术', '周建华', 3.5, 56, 50, 40, '电子信息学院', '半导体器件、放大电路、运算放大器', '周二3-4节 周四3-4节', '致远楼102'),
('EE103', '数字电子技术', '吴明', 3.0, 48, 55, 28, '电子信息学院', '组合逻辑、时序逻辑、可编程逻辑器件', '周一5-6节 周三5-6节', '致远楼103'),
('EE104', '信号与系统', '郑天宇', 3.5, 56, 50, 47, '电子信息学院', '连续/离散信号分析、傅里叶变换、拉普拉斯变换', '周二1-2节 周四1-2节', '致远楼201'),

-- 管理学院
('MG101', '管理学原理', '钱学礼', 3.0, 48, 80, 65, '管理学院', '管理理论发展、计划组织领导控制', '周一1-2节 周三1-2节', '致用楼101'),
('MG102', '市场营销学', '许文静', 3.0, 48, 70, 55, '管理学院', '市场调研、4P策略、品牌管理', '周二5-6节 周四5-6节', '致用楼102'),
('MG103', '财务管理', '蒋国强', 3.5, 56, 65, 42, '管理学院', '财务报表分析、投资决策、融资策略', '周一7-8节 周三7-8节', '致用楼103'),
('MG104', '人力资源管理', '韩梅梅', 3.0, 48, 60, 33, '管理学院', '招聘选拔、绩效管理、薪酬福利设计', '周五1-2节', '致用楼104'),

-- 外国语学院
('FL101', '大学英语IV', 'Michael Brown', 4.0, 64, 90, 88, '外国语学院', '高级英语读写、学术英语、跨文化交际', '周一3-4节 周三3-4节 周五3-4节', '致远楼301'),
('FL102', '日语入门', '田中惠子', 3.0, 48, 40, 38, '外国语学院', '日语基础发音、基本句型、日常会话', '周二7-8节 周四7-8节', '致远楼302'),
('FL103', '英语口语训练', 'Sarah Johnson', 2.0, 32, 35, 35, '外国语学院', '情景对话、演讲技巧、听力训练', '周五5-6节', '语言实验室101'),

-- 数学学院
('MA101', '高等数学A', '杨启明', 5.0, 80, 100, 95, '数学学院', '微积分、级数、常微分方程', '周一1-2节 周二1-2节 周三1-2节 周四1-2节', '致远楼401'),
('MA102', '线性代数', '马丽华', 3.0, 48, 80, 60, '数学学院', '矩阵理论、向量空间、特征值', '周一5-6节 周三5-6节', '致远楼402'),
('MA103', '概率论与数理统计', '曹志刚', 3.5, 56, 75, 48, '数学学院', '随机变量、概率分布、参数估计、假设检验', '周二3-4节 周四3-4节', '致远楼403'),

-- 人文学院
('HU101', '中国近现代史纲要', '徐明德', 3.0, 48, 120, 110, '人文学院', '1840年以来中国历史发展进程', '周一7-8节 周三7-8节', '致远楼501'),
('HU102', '大学语文', '朱文华', 2.0, 32, 80, 50, '人文学院', '经典文学作品赏析、写作训练', '周五1-2节', '致远楼502'),
('HU103', '演讲与口才', '范长江', 2.0, 32, 60, 45, '人文学院', '公众演讲、辩论技巧、沟通艺术', '周二5-6节', '致远楼503');

-- ============================================================
-- 示例数据：选课窗口
-- ============================================================
INSERT INTO cs_time_windows (name, start_time, end_time, course_type, is_active) VALUES
('2026春季必修课选课', '2026-05-20 08:00:00+08', '2026-06-30 23:59:59+08', 'required', true),
('2026春季公选课选课', '2026-05-25 08:00:00+08', '2026-06-15 23:59:59+08', 'optional', true),
('补退选窗口', '2026-09-01 08:00:00+08', '2026-09-15 23:59:59+08', 'required', false);

-- ============================================================
-- 示例数据：学生
-- ============================================================
INSERT INTO cs_students (student_id, name, department, grade, max_courses) VALUES
('202410012234', '张三', '计算机学院', '2024级', 6),
('202410012235', '李四', '电子信息学院', '2024级', 5),
('202410012236', '王五', '管理学院', '2024级', 5),
('202410012237', '赵六', '计算机学院', '2024级', 5),
('202410012238', '钱七', '外国语学院', '2024级', 5);

-- ============================================================
-- RLS 策略
-- ============================================================
ALTER TABLE cs_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_time_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_selection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_students ENABLE ROW LEVEL SECURITY;

-- 所有人可读课程
CREATE POLICY cs_courses_select ON cs_courses FOR SELECT USING (true);
CREATE POLICY cs_courses_insert ON cs_courses FOR INSERT WITH CHECK (true);
CREATE POLICY cs_courses_update ON cs_courses FOR UPDATE USING (true);

-- 所有人可读时间窗口
CREATE POLICY cs_tw_select ON cs_time_windows FOR SELECT USING (true);
CREATE POLICY cs_tw_all ON cs_time_windows FOR ALL USING (true) WITH CHECK (true);

-- 选课记录：所有人可操作（后端通过 anon key 写入，业务逻辑在后端校验）
CREATE POLICY cs_sel_all ON cs_selections FOR ALL USING (true) WITH CHECK (true);

-- 日志：所有人可操作
CREATE POLICY cs_log_all ON cs_selection_logs FOR ALL USING (true) WITH CHECK (true);

-- 学生：所有人可读
CREATE POLICY cs_stu_select ON cs_students FOR SELECT USING (true);
CREATE POLICY cs_stu_all ON cs_students FOR ALL USING (true) WITH CHECK (true);
