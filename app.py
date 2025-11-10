# app.py
import os
import csv
import io
import sqlite3
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta

# Configuration
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET") or os.urandom(24)

DB_FILE = "fitness_app.db"
ADMIN_EMAIL = "elay@micds.org"
TEACHER_EMAIL = "emily@micds.org"
ADMIN_PASSWORD_PLAIN = "adminrights"
TEACHER_PASSWORD_PLAIN = "teacherrights"

# ---------- Utilities ----------
def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DB_FILE, detect_types=sqlite3.PARSE_DECLTYPES)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()

def dict_from_row(row):
    return dict(row) if row else None

def is_admin():
    return session.get("role") == "admin"

def log_activity(action, detail="", user_id=None):
    """Insert an entry into activity_logs for audit trail."""
    try:
        db = get_db()
        cur = db.cursor()
        cur.execute("""
                    INSERT INTO activity_logs (action, detail, user_id, created_at)
                    VALUES (?, ?, ?, ?)
                    """, (action, detail, user_id, datetime.utcnow()))
        db.commit()
    except Exception as e:
        app.logger.warning("Failed to write activity log: %s", e)


# ================================================================
# ===================== DATABASE INIT ============================
# ================================================================
def init_db():
    """Initialize professional-grade fitness/education tracking database."""
    with sqlite3.connect(DB_FILE) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        # USERS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS users (
                                                       id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                       email TEXT UNIQUE NOT NULL,
                                                       password TEXT NOT NULL,
                                                       name TEXT,
                                                       role TEXT CHECK(role IN ('admin', 'teacher', 'student')) DEFAULT 'student',
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                      )
                  """)

        # CLASSES
        c.execute("""
                  CREATE TABLE IF NOT EXISTS classes (
                                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                         teacher_id INTEGER NOT NULL,
                                                         name TEXT NOT NULL,
                                                         description TEXT,
                                                         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                         FOREIGN KEY(teacher_id) REFERENCES users(id)
                      )
                  """)

        # TEACHER-STUDENT RELATIONSHIP
        c.execute("""
                  CREATE TABLE IF NOT EXISTS teacher_students (
                                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                  teacher_id INTEGER NOT NULL,
                                                                  student_id INTEGER NOT NULL,
                                                                  class_id INTEGER,
                                                                  FOREIGN KEY(teacher_id) REFERENCES users(id),
                      FOREIGN KEY(student_id) REFERENCES users(id),
                      FOREIGN KEY(class_id) REFERENCES classes(id)
                      )
                  """)

        # FORMS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS forms (
                                                       id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                       teacher_id INTEGER NOT NULL,
                                                       class_id INTEGER,
                                                       question TEXT NOT NULL,
                                                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                       due_date TIMESTAMP,
                                                       status TEXT DEFAULT 'active',
                                                       average_rating REAL,
                                                       FOREIGN KEY(teacher_id) REFERENCES users(id),
                      FOREIGN KEY(class_id) REFERENCES classes(id)
                      )
                  """)

        # SUBMISSIONS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS submissions (
                                                             id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                             form_id INTEGER NOT NULL,
                                                             student_id INTEGER NOT NULL,
                                                             student_response TEXT,
                                                             student_rating INTEGER CHECK(student_rating BETWEEN 1 AND 4),
                      teacher_rating INTEGER CHECK(teacher_rating BETWEEN 1 AND 4),
                      teacher_feedback TEXT,
                      submitted_at TIMESTAMP,
                      graded INTEGER DEFAULT 0,
                      late INTEGER DEFAULT 0,
                      completed INTEGER DEFAULT 0,
                      FOREIGN KEY(form_id) REFERENCES forms(id),
                      FOREIGN KEY(student_id) REFERENCES users(id)
                      )
                  """)

        # STUDENT STATISTICS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS student_statistics (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    student_id INTEGER UNIQUE NOT NULL,
                                                                    height REAL, weight REAL, bmi REAL,
                                                                    vertical_jump REAL, broad_jump REAL,
                                                                    flying_10 REAL, track_interval REAL,
                                                                    hang_clean REAL, bench REAL, back_squat REAL, front_squat REAL,
                                                                    balance_left REAL, balance_right REAL, jump_force REAL, air_time REAL,
                                                                    workout_consistency REAL,
                                                                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                                    FOREIGN KEY(student_id) REFERENCES users(id)
                      )
                  """)

        # STUDENT ACHIEVEMENTS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS student_achievements (
                                                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                      student_id INTEGER NOT NULL,
                                                                      title TEXT NOT NULL,
                                                                      description TEXT,
                                                                      achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                                      added_by INTEGER,
                                                                      FOREIGN KEY(student_id) REFERENCES users(id),
                      FOREIGN KEY(added_by) REFERENCES users(id)
                      )
                  """)

        # STUDENT SPORTS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS student_sports (
                                                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                student_id INTEGER NOT NULL,
                                                                sport_name TEXT NOT NULL,
                                                                season TEXT,
                                                                coach_notes TEXT DEFAULT 'Work in progress',
                                                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                                FOREIGN KEY(student_id) REFERENCES users(id)
                      )
                  """)

        # SPORTS CREDITS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS sports_credits (
                                                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                student_id INTEGER NOT NULL,
                                                                sport_id INTEGER,
                                                                credits INTEGER DEFAULT 0,
                                                                FOREIGN KEY(student_id) REFERENCES users(id),
                      FOREIGN KEY(sport_id) REFERENCES student_sports(id)
                      )
                  """)

        # FEEDBACK TEMPLATES
        c.execute("""
                  CREATE TABLE IF NOT EXISTS feedback_templates (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    teacher_id INTEGER NOT NULL,
                                                                    title TEXT NOT NULL,
                                                                    content TEXT NOT NULL,
                                                                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                                    FOREIGN KEY(teacher_id) REFERENCES users(id)
                      )
                  """)

        # STUDENT PROGRESS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS student_progress (
                                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                  student_id INTEGER NOT NULL,
                                                                  streak_count INTEGER DEFAULT 0,
                                                                  last_completed TIMESTAMP,
                                                                  FOREIGN KEY(student_id) REFERENCES users(id)
                      )
                  """)

        # NOTIFICATIONS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS notifications (
                                                               id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                               user_id INTEGER NOT NULL,
                                                               type TEXT CHECK(type IN ('new','graded','late','achievement','update')) NOT NULL,
                      title TEXT,
                      message TEXT NOT NULL,
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      read INTEGER DEFAULT 0,
                      FOREIGN KEY(user_id) REFERENCES users(id)
                      )
                  """)

        # NEWS FEED
        c.execute("""
                  CREATE TABLE IF NOT EXISTS news_feed (
                                                           id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                           title TEXT NOT NULL,
                                                           description TEXT,
                                                           category TEXT DEFAULT 'student_achievement',
                                                           created_by INTEGER,
                                                           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                           FOREIGN KEY(created_by) REFERENCES users(id)
                      )
                  """)

        # MESSAGES (for internal messenger)
        c.execute("""
                  CREATE TABLE IF NOT EXISTS messages (
                                                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                          thread_id INTEGER,
                                                          sender_id INTEGER,
                                                          recipient_id INTEGER,
                                                          content TEXT NOT NULL,
                                                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                          FOREIGN KEY(sender_id) REFERENCES users(id),
                      FOREIGN KEY(recipient_id) REFERENCES users(id)
                      )
                  """)

        # ACTIVITY LOGS
        c.execute("""
                  CREATE TABLE IF NOT EXISTS activity_logs (
                                                               id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                               action TEXT NOT NULL,
                                                               detail TEXT,
                                                               user_id INTEGER,
                                                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                                               FOREIGN KEY(user_id) REFERENCES users(id)
                      )
                  """)

        # SEED ADMIN (if not exists)
        c.execute("SELECT id FROM users WHERE email = ?", (ADMIN_EMAIL,))
        if not c.fetchone():
            c.execute("""
                      INSERT INTO users (email, password, role, name)
                      VALUES (?, ?, 'admin', 'System Admin')
                      """, (ADMIN_EMAIL, generate_password_hash(ADMIN_PASSWORD_PLAIN)))
            c.execute("""
                      INSERT INTO users (email, password, role, name)
                      VALUES (?, ?, 'teacher', 'Example Teacher')
                          """, (TEACHER_EMAIL, generate_password_hash(TEACHER_PASSWORD_PLAIN)))
            c.execute("""
                      INSERT INTO users (email, password, role, name)
                      VALUES (?, ?, 'student', 'Example Student')
                      """, ("me@micds.org", generate_password_hash("studentrights")))
            conn.commit()

        conn.commit()


# ================================================================
# ======================= AUTH ROUTES ============================
# ================================================================
@app.route('/', methods=['GET', 'POST'])
def auth():
    if request.method == 'POST':
        email = request.form['email'].strip().lower()
        password = request.form['password']

        db = get_db()
        c = db.cursor()
        c.execute("SELECT id, password, role FROM users WHERE email = ?", (email,))
        user = c.fetchone()

        if user and check_password_hash(user["password"], password):
            session['user_id'] = user["id"]
            session['email'] = email
            session['role'] = user["role"]

            if email == ADMIN_EMAIL or user["role"] == "admin":
                return redirect(url_for('admin_dashboard'))
            elif email == TEACHER_EMAIL or user["role"] == 'teacher':
                return redirect(url_for('teacher_dashboard'))
            else:
                return redirect(url_for('student_dashboard'))
        else:
            flash("Invalid email or password.", "danger")

    return render_template("auth.html")


@app.route('/auth/logout')
def logout():
    session.clear()
    return redirect(url_for('auth'))


# Placeholder dashboards for teacher/student
@app.route('/teacher')
def teacher_dashboard():
    return render_template("teacher.html")

@app.route('/student')
def student_dashboard():
    return render_template("student.html")


# ================================================================
# ===================== ADMIN DASHBOARD ==========================
# ================================================================
@app.route('/admin')
def admin_dashboard():
    if not is_admin():
        return redirect(url_for('auth'))

    db = get_db()
    c = db.cursor()
    c.execute("SELECT id, name, email FROM users WHERE role='teacher'")
    teachers = [dict(r) for r in c.fetchall()]

    c.execute("SELECT id, name, email FROM users WHERE role='student'")
    students = [dict(r) for r in c.fetchall()]

    c.execute("SELECT id, name, description FROM classes")
    classes = [dict(r) for r in c.fetchall()]

    # render your admin dashboard template (must exist under templates/)
    return render_template(
        "admin.html",
        teachers=teachers,
        students=students,
        classes=classes
    )


# ---------------- ADD TEACHER/STUDENT ---------------- #
@app.route('/admin/add_user', methods=['POST'])
def add_user():
    if session.get('role') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    role = data.get('role', '').strip().lower()
    password = data.get('password', '').strip() or "password123"  # default

    if not name or not email or role not in ('admin', 'teacher', 'student'):
        return jsonify({"error": "Invalid data"}), 400

    hashed_pw = generate_password_hash(password)

    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        try:
            c.execute("INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)",
                      (name, email, role, hashed_pw))
            conn.commit()
            return jsonify({"message": f"{role.capitalize()} added successfully!"})
        except sqlite3.IntegrityError:
            return jsonify({"error": "Email already exists"}), 400


# ---------------- CHANGE ROLE ---------------- #
@app.route('/admin/change_role', methods=['POST'])
def change_role():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    email = (data.get('email') or "").strip().lower()
    user_id = data.get('user_id')
    new_role = (data.get('role') or "").strip().lower()

    if new_role not in ('admin', 'teacher', 'student'):
        return jsonify({"error": "Invalid role"}), 400

    db = get_db()
    c = db.cursor()

    if user_id:
        c.execute("SELECT id, role, email FROM users WHERE id = ?", (user_id,))
    elif email:
        c.execute("SELECT id, role, email FROM users WHERE email = ?", (email,))
    else:
        return jsonify({"error": "Email or user_id required"}), 400

    user = c.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        c.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user["id"]))
        db.commit()
        log_activity("change_role", f"{user['email']} => {new_role}", user_id=session.get("user_id"))
        return jsonify({"message": "Role updated"})
    except Exception:
        app.logger.exception("Failed to change role")
        return jsonify({"error": "Server error"}), 500


# ---------------- ASSIGN STUDENT TO TEACHER ---------------- #
@app.route('/admin/assign', methods=['POST'])
def assign_student():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    teacher = data.get('teacher_id') or data.get('teacher_email')
    student = data.get('student_id') or data.get('student_email')
    class_id = data.get('class_id')

    if not teacher or not student:
        return jsonify({"error": "Teacher and student required"}), 400

    db = get_db()
    c = db.cursor()

    # Resolve teacher
    if isinstance(teacher, str) and '@' in teacher:
        c.execute("SELECT id FROM users WHERE email = ?", (teacher.lower(),))
        t = c.fetchone()
        if not t:
            return jsonify({"error": f"Teacher {teacher} not found"}), 404
        teacher_id = t["id"]
    else:
        teacher_id = int(teacher)

    # Resolve student
    if isinstance(student, str) and '@' in student:
        c.execute("SELECT id FROM users WHERE email = ?", (student.lower(),))
        s = c.fetchone()
        if not s:
            return jsonify({"error": f"Student {student} not found"}), 404
        student_id = s["id"]
    else:
        student_id = int(student)

    try:
        c.execute(
            "INSERT INTO teacher_students (teacher_id, student_id, class_id) VALUES (?, ?, ?)",
            (teacher_id, student_id, class_id)
        )
        db.commit()
        log_activity("assign", f"Teacher {teacher_id} assigned student {student_id} class {class_id}", user_id=session.get("user_id"))
        return jsonify({"message": "Student assigned successfully"})
    except sqlite3.IntegrityError:
        return jsonify({"error": "This assignment already exists"}), 400
    except Exception:
        app.logger.exception("Assign failed")
        return jsonify({"error": "Server error"}), 500


# ---------------- SEARCH ---------------- #
@app.route("/admin/search")
def admin_search():
    qval=(request.args.get("q") or "").strip().lower()
    if not qval: return jsonify([])
    db=get_db()
    qparam=f"%{qval}%"
    results=[dict(r) for r in db.execute(
        "SELECT id, COALESCE(name,email) AS name, role FROM users WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ? LIMIT 40",
        (qparam,qparam)
    )]
    return jsonify(results)


# ---------------- BULK UPLOAD (CSV) ---------------- #
ALLOWED_EXTENSIONS = {'csv'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/admin/bulk_upload', methods=['POST'])
def bulk_upload():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403

    file = request.files.get('file')
    upload_type = request.form.get('type') or request.form.get('uploadType') or 'users'
    if not file or not allowed_file(file.filename):
        return jsonify({"error": "Please upload a CSV file."}), 400

    filename = secure_filename(file.filename)
    stream = io.StringIO(file.stream.read().decode("utf-8", errors="replace"))
    reader = csv.DictReader(stream)
    errors = []
    inserted = 0

    db = get_db()
    cur = db.cursor()

    # Wrap in a transaction
    try:
        for i, row in enumerate(reader, start=2):  # 1-based header row is row=1
            row_context = {"row": i, "data": dict(row)}
            try:
                if upload_type == 'users':
                    # Expecting: name,email,role
                    name = (row.get('name') or row.get('full_name') or "").strip()
                    email = (row.get('email') or "").strip().lower()
                    role = (row.get('role') or 'student').strip().lower()
                    if not email:
                        errors.append({"row": i, "error": "Missing email"})
                        continue
                    if role not in ('student', 'teacher', 'admin'):
                        errors.append({"row": i, "error": f"Invalid role '{role}'"})
                        continue
                    try:
                        cur.execute(
                            "INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)",
                            (name, email, role, generate_password_hash("password123"))
                        )
                        inserted += 1
                    except sqlite3.IntegrityError:
                        errors.append({"row": i, "error": "Email already exists"})
                elif upload_type == 'classes':
                    # Expecting: teacher_id,name,description OR teacher_email,name,description
                    teacher_id = row.get('teacher_id')
                    teacher_email = (row.get('teacher_email') or "").strip().lower()
                    name = (row.get('name') or "").strip()
                    desc = (row.get('description') or "").strip()
                    if not name:
                        errors.append({"row": i, "error": "Missing class name"})
                        continue
                    # resolve teacher_id by email if provided
                    if not teacher_id and teacher_email:
                        cur.execute("SELECT id FROM users WHERE email = ?", (teacher_email,))
                        t = cur.fetchone()
                        if t:
                            teacher_id = t["id"]
                    if not teacher_id:
                        errors.append({"row": i, "error": "Missing teacher id/email"})
                        continue
                    try:
                        cur.execute("INSERT INTO classes (teacher_id, name, description) VALUES (?, ?, ?)",
                                    (teacher_id, name, desc))
                        inserted += 1
                    except sqlite3.IntegrityError as e:
                        errors.append({"row": i, "error": "Insert failed"})
                elif upload_type == 'grades' or upload_type == 'grades':
                    # Expecting student_id,form_id,grade
                    student_id = row.get('student_id')
                    form_id = row.get('form_id')
                    grade = row.get('grade')
                    if not student_id or not form_id:
                        errors.append({"row": i, "error": "Missing student_id or form_id"})
                        continue
                    # simple insertion: create a submission entry (ungraded/graded depending on grade)
                    try:
                        submitted_at = datetime.utcnow()
                        graded = 1 if grade else 0
                        cur.execute("""
                                    INSERT INTO submissions (form_id, student_id, student_response, student_rating, submitted_at, graded, completed)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)
                                    """, (form_id, student_id, "", int(grade) if grade and grade.isdigit() else None, submitted_at, graded, 1 if grade else 0))
                        inserted += 1
                    except Exception as e:
                        errors.append({"row": i, "error": "Insert failed"})
                else:
                    errors.append({"row": i, "error": f"Unknown upload type: {upload_type}"})
            except Exception as e:
                app.logger.exception("Row processing failed")
                errors.append({"row": i, "error": str(e)})
        db.commit()
        log_activity("bulk_upload", f"Type={upload_type} inserted={inserted} errors={len(errors)}", user_id=session.get("user_id"))
        resp = {"message": f"Upload complete ({inserted} inserted)", "inserted": inserted}
        if errors:
            resp["errors"] = errors
        return jsonify(resp)
    except Exception as e:
        db.rollback()
        app.logger.exception("Bulk upload failed")
        return jsonify({"error": "Upload failed"}), 500


# ---------------- NOTIFICATIONS (broadcast) ---------------- #
@app.route('/admin/notify', methods=['POST'])
def notify():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    title = (data.get('title') or "").strip()
    message = (data.get('message') or "").strip()
    if not title or not message:
        return jsonify({"error": "Title and message required."}), 400

    db = get_db()
    c = db.cursor()
    try:
        # If broadcast: create a notification row for every user
        c.execute("SELECT id FROM users")
        users = [r["id"] for r in c.fetchall()]
        now = datetime.utcnow()
        for uid in users:
            c.execute("INSERT INTO notifications (user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?)",
                      (uid, "update", title, message, now))
        db.commit()
        log_activity("notify", f"Broadcast: {title}", user_id=session.get("user_id"))
        return jsonify({"message": f"Notification broadcast to {len(users)} users."})
    except Exception:
        db.rollback()
        app.logger.exception("Notification failed")
        return jsonify({"error": "Server error"}), 500


# ---------------- CREATE CLASS ---------------- #
@app.route('/admin/class/create', methods=['POST'])
def create_class():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    name = (data.get('name') or "").strip()
    description = (data.get('description') or "").strip()
    teacher = data.get('teacher')  # can be id or email

    if not name:
        return jsonify({"error": "Class name required."}), 400

    db = get_db()
    c = db.cursor()

    # resolve teacher id if an email is provided
    teacher_id = None
    if teacher:
        try:
            # accept numeric id
            teacher_id = int(teacher)
        except Exception:
            # try email
            c.execute("SELECT id FROM users WHERE email = ?", (teacher.strip().lower(),))
            res = c.fetchone()
            if res:
                teacher_id = res["id"]

    if not teacher_id:
        return jsonify({"error": "Valid teacher id/email required."}), 400

    try:
        c.execute("INSERT INTO classes (teacher_id, name, description) VALUES (?, ?, ?)", (teacher_id, name, description))
        db.commit()
        class_id = c.lastrowid
        log_activity("create_class", f"Class {class_id} '{name}' by teacher {teacher_id}", user_id=session.get("user_id"))
        return jsonify({"message": "Class created", "id": class_id})
    except Exception:
        db.rollback()
        app.logger.exception("Create class failed")
        return jsonify({"error": "Server error"}), 500


# ---------------- MESSAGING POST ---------------- #
@app.route('/admin/messages', methods=['POST'])
def post_message():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    to = data.get('to')
    text = (data.get('text') or "").strip()

    if not to or not text:
        return jsonify({"error": "Recipient and text required."}), 400

    db = get_db()
    c = db.cursor()
    try:
        # a simple messages insert; thread_id can be generated later
        c.execute("INSERT INTO messages (sender_id, recipient_id, content, created_at) VALUES (?, ?, ?, ?)",
                  (session.get('user_id'), to, text, datetime.utcnow()))
        db.commit()
        log_activity("message", f"Msg to {to}: {text[:80]}", user_id=session.get("user_id"))
        return jsonify({"message": "Sent"})
    except Exception:
        db.rollback()
        app.logger.exception("Message send failed")
        return jsonify({"error": "Server error"}), 500


# ---------------- ACTIVITY (pull recent) ---------------- #
@app.route('/admin/activity', methods=['GET'])
def get_activity():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403

    limit = int(request.args.get('limit', 50))
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id, action, detail, user_id, created_at FROM activity_logs ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in c.fetchall()]
    return jsonify(rows)


# ---------------- STATS (for rings) ---------------- #
@app.route('/admin/stats', methods=['GET'])
def admin_stats():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403

    db = get_db()
    c = db.cursor()

    # total students & active students in last 30 days
    c.execute("SELECT COUNT(*) as total FROM users WHERE role = 'student'")
    total_students = c.fetchone()["total"] or 0

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    c.execute("SELECT COUNT(DISTINCT student_id) as active FROM submissions WHERE submitted_at >= ?", (thirty_days_ago,))
    active_students = c.fetchone()["active"] or 0

    # completion rate = graded submissions / total submissions
    c.execute("SELECT COUNT(*) as total FROM submissions")
    total_subs = c.fetchone()["total"] or 0
    c.execute("SELECT COUNT(*) as graded FROM submissions WHERE graded = 1")
    graded_subs = c.fetchone()["graded"] or 0

    # weekly participation = distinct students with submissions in last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    c.execute("SELECT COUNT(DISTINCT student_id) as weekly_active FROM submissions WHERE submitted_at >= ?", (seven_days_ago,))
    weekly_active = c.fetchone()["weekly_active"] or 0

    # teacher engagement = percent of teachers who have graded submissions in last 30 days
    c.execute("SELECT COUNT(*) as total_t FROM users WHERE role = 'teacher'")
    total_teachers = c.fetchone()["total_t"] or 0
    c.execute("""
              SELECT COUNT(DISTINCT u.id) as engaged
              FROM users u
                       JOIN submissions s ON s.form_id IS NOT NULL
                       JOIN forms f ON f.id = s.form_id
              WHERE u.role = 'teacher' AND f.teacher_id = u.id AND s.graded = 1 AND s.submitted_at >= ?
              """, (thirty_days_ago,))
    engaged_teachers = c.fetchone()["engaged"] or 0

    def pct(part, whole):
        try:
            return round(float(part) / float(whole) * 100, 0) if whole else 0
        except Exception:
            return 0

    stats = {
        "activePct": int(pct(active_students, total_students)),
        "completionPct": int(pct(graded_subs, total_subs)),
        "weeklyPct": int(pct(weekly_active, total_students)),
        "teacherPct": int(pct(engaged_teachers, total_teachers)),
        "goalPct": int(pct(graded_subs, total_subs))  # placeholder: reuse completion as 'goal'
    }

    return jsonify(stats)

# ================================================================
# ====================== TEACHER API ROUTES ======================
# ================================================================

def require_teacher():
    if session.get("role") != "teacher":
        return jsonify({"error": "Unauthorized"}), 403
    return None


# ---------------------------------------------------------------
# GET: Classes for logged-in teacher
# ---------------------------------------------------------------
@app.route("/api/teacher/classes")
def api_teacher_classes():
    unauthorized = require_teacher()
    if unauthorized: return unauthorized

    teacher_id = session.get("user_id")
    db = get_db()
    c = db.cursor()

    c.execute("""
              SELECT id, name, description,
                     (SELECT COUNT(*) FROM teacher_students ts WHERE ts.class_id = classes.id) AS student_count
              FROM classes
              WHERE teacher_id = ?
              ORDER BY id DESC
              """, (teacher_id,))
    rows = [dict(r) for r in c.fetchall()]

    return jsonify(rows)


# ---------------------------------------------------------------
# POST: Assign a form to a class
# ---------------------------------------------------------------
@app.route("/api/forms/assign", methods=["POST"])
def api_assign_form():
    unauthorized = require_teacher()
    if unauthorized: return unauthorized

    data = request.get_json() or {}
    teacher_id = session.get("user_id")

    class_id = data.get("classId")
    question = (data.get("question") or "").strip()
    due_date = data.get("dueDate")

    if not class_id or not question:
        return jsonify({"error": "classId and question required"}), 400

    db = get_db()
    c = db.cursor()

    try:
        c.execute("""
                  INSERT INTO forms (teacher_id, class_id, question, due_date, status)
                  VALUES (?, ?, ?, ?, 'active')
                  """, (teacher_id, class_id, question, due_date))
        db.commit()
        log_activity("assign_form", f"class {class_id}", user_id=teacher_id)
        return jsonify({"message": "Form assigned"})
    except Exception:
        db.rollback()
        return jsonify({"error": "DB insert failed"}), 500


# ---------------------------------------------------------------
# POST: Add an achievement to a student
# ---------------------------------------------------------------
@app.route("/api/achievements/add", methods=["POST"])
def api_add_achievement():
    unauthorized = require_teacher()
    if unauthorized: return unauthorized

    data = request.get_json() or {}
    teacher_id = session.get("user_id")

    student_id = data.get("studentId")
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()

    if not student_id or not title:
        return jsonify({"error": "studentId and title required"}), 400

    db = get_db()
    c = db.cursor()

    try:
        c.execute("""
                  INSERT INTO student_achievements (student_id, title, description, added_by)
                  VALUES (?, ?, ?, ?)
                  """, (student_id, title, description, teacher_id))
        db.commit()
        log_activity("add_achievement", f"student {student_id}", user_id=teacher_id)
        return jsonify({"message": "Achievement added"})
    except Exception:
        db.rollback()
        return jsonify({"error": "DB insert failed"}), 500


# ---------------------------------------------------------------
# POST: Grade a submission
# ---------------------------------------------------------------
@app.route("/api/submissions/grade", methods=["POST"])
def api_grade_submission():
    unauthorized = require_teacher()
    if unauthorized: return unauthorized

    data = request.get_json() or {}
    teacher_id = session.get("user_id")

    sub_id = data.get("submissionId")
    rating = data.get("rating")
    feedback = (data.get("feedback") or "").strip()

    if not sub_id or not rating:
        return jsonify({"error": "submissionId and rating required"}), 400

    db = get_db()
    c = db.cursor()

    try:
        c.execute("""
                  UPDATE submissions
                  SET teacher_rating = ?, teacher_feedback = ?, graded = 1
                  WHERE id = ?
                  """, (rating, feedback, sub_id))
        db.commit()
        log_activity("grade_submission", f"submission {sub_id}", user_id=teacher_id)
        return jsonify({"message": "Submission graded"})
    except Exception:
        db.rollback()
        return jsonify({"error": "DB update failed"}), 500


# ---------------------------------------------------------------
# GET: Messenger threads list (students assigned to teacher)
# ---------------------------------------------------------------
@app.route("/api/messages/threads")
def api_message_threads():
    unauthorized = require_teacher()
    if unauthorized: return unauthorized

    teacher_id = session.get("user_id")
    db = get_db()
    c = db.cursor()

    c.execute("""
              SELECT DISTINCT u.id, u.name, u.email
              FROM teacher_students ts
                       JOIN users u ON u.id = ts.student_id
              WHERE ts.teacher_id = ?
              ORDER BY u.name
              """, (teacher_id,))

    return jsonify([dict(r) for r in c.fetchall()])


# ---------------------------------------------------------------
# GET: Messages for a thread (teacher <-> student)
# ---------------------------------------------------------------
@app.route("/api/messages/thread/<int:student_id>")
def api_messages_for_thread(student_id):
    unauthorized = require_teacher()
    if unauthorized: return unauthorized

    teacher_id = session.get("user_id")
    db = get_db()
    c = db.cursor()

    # verify this student belongs to this teacher
    c.execute("""
              SELECT 1 FROM teacher_students WHERE teacher_id = ? AND student_id = ?
              """, (teacher_id, student_id))
    if not c.fetchone():
        return jsonify({"error": "Not linked to this student"}), 403

    c.execute("""
              SELECT id, sender_id, recipient_id, content, created_at
              FROM messages
              WHERE (sender_id = ? AND recipient_id = ?)
                 OR (sender_id = ? AND recipient_id = ?)
              ORDER BY created_at ASC
              """, (teacher_id, student_id, student_id, teacher_id))

    return jsonify([dict(r) for r in c.fetchall()])


# ---------------------------------------------------------------
# POST: Send a message (teacher -> student)
# ---------------------------------------------------------------
@app.route("/api/messages/send", methods=["POST"])
def api_send_message():
    unauthorized = require_teacher()
    if unauthorized: return unauthorized

    data = request.get_json() or {}
    teacher_id = session.get("user_id")

    student_id = data.get("studentId")
    content = (data.get("content") or "").strip()
    if not student_id or not content:
        return jsonify({"error": "studentId and content required"}), 400

    db = get_db()
    c = db.cursor()

    try:
        c.execute("""
                  INSERT INTO messages (sender_id, recipient_id, content)
                  VALUES (?, ?, ?)
                  """, (teacher_id, student_id, content))
        db.commit()
        log_activity("teacher_msg", f"to {student_id}", user_id=teacher_id)
        return jsonify({"message": "Sent"})
    except Exception:
        db.rollback()
        return jsonify({"error": "DB insert failed"}), 500


# ---------------------------------------------------------------
# POST: Add student stats entry
# ---------------------------------------------------------------
@app.route("/api/stats/add", methods=["POST"])
def api_stats_add():
    unauthorized = require_teacher()
    if unauthorized: return unauthorized

    data = request.get_json() or {}
    student_id = data.get("studentId")

    if not student_id:
        return jsonify({"error": "studentId required"}), 400

    db = get_db()
    c = db.cursor()

    # Minimal insert/update example
    try:
        c.execute("""
                  INSERT INTO student_statistics (student_id, updated_at)
                  VALUES (?, ?)
                      ON CONFLICT(student_id) DO UPDATE SET updated_at=excluded.updated_at
                  """, (student_id, datetime.utcnow()))
        db.commit()
        return jsonify({"message": "Stats updated"})
    except Exception:
        db.rollback()
        return jsonify({"error": "DB update failed"}), 500

'''
# app.py
import os
import io
import json
import time
import logging
from typing import Any, Dict
from flask import Flask, request, jsonify, send_file, abort
from werkzeug.utils import secure_filename

from models import (
    TrendEnsembleWrapper,
    InjuryRiskWrapper,
    TechniqueAnalysisWrapper,
    WorkloadOptimizerWrapper,
    RecoveryPredictorWrapper,
    TalentScoutWrapper,
    PersonalizedPlanWrapper,
)
from utils import openrouter_explain, allowed_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("profile-api")

# Configure directories
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "./uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200MB for video uploads; adapt as needed

# Instantiate lazy model wrappers (they'll load weights on first use)
MODEL_WRAPPERS = {
    "trend-ensemble": TrendEnsembleWrapper(),
    "injury-risk": InjuryRiskWrapper(),
    "technique-analysis": TechniqueAnalysisWrapper(),
    "workload-optimizer": WorkloadOptimizerWrapper(),
    "recovery-predictor": RecoveryPredictorWrapper(),
    "talent-scout": TalentScoutWrapper(),
    "personalized-plan": PersonalizedPlanWrapper(),
}

# === Example profile retrieval (replace with your DB queries) ===
@app.route("/api/profile/<int:profile_id>", methods=["GET"])
def get_profile(profile_id: int):
    # MOCK: return example profile. Replace with DB lookup.
    profile = {
        "id": profile_id,
        "displayName": "Alex Parker",
        "classYear": "2026",
        "summary": "Student-athlete passionate about track & field and strength training.",
        "profilePic": None,
        "sports": ["Track (Spring 2025)", "Soccer (Fall 2024)"],
        "achievements": [{"id": 1, "title": "Player of the Week", "date": "2025-10-20"}],
        "stats": {"vjump": 44, "broad": 195, "hangclean": 82, "bench": 90, "maxsprint": 8.4, "consistency": 86},
        "history": [["2025-05-01", "vjump", 40], ["2025-07-01", "vjump", 42], ["2025-09-01", "vjump", 44]],
        "badges": [{"id": "b1", "title": "Effort Badge"}],
        "credits": 6,
        "lastActive": "2025-11-08",
    }
    return jsonify(profile)


# === Model-run entry point ===
@app.route("/api/profile/<int:profile_id>/models/<string:model_key>", methods=["POST"])
def run_model(profile_id: int, model_key: str):
    """
    Expects JSON payload like:
      { "profileId": 1234, "options": {...} }
    Or multipart/form-data for file uploads (technique-analysis).
    The server calls the appropriate wrapper. Wrappers must be safe and CPU/GPU aware.
    """
    wrapper = MODEL_WRAPPERS.get(model_key)
    if not wrapper:
        return jsonify({"error": "Unknown model key"}), 404

    # dispatch to wrapper
    try:
        if model_key == "technique-analysis":
            # file upload path (supports video upload)
            if "video" not in request.files:
                return jsonify({"error": "Missing video file (form field 'video')"}), 400
            f = request.files["video"]
            if f.filename == "" or not allowed_file(f.filename, ext_whitelist={"mp4", "mov", "mkv", "webm"}):
                return jsonify({"error": "Invalid or missing video file"}), 400
            filename = secure_filename(f.filename)
            saved_path = os.path.join(app.config["UPLOAD_FOLDER"], f"{int(time.time())}_{filename}")
            f.save(saved_path)

            # the wrapper handles reading the file, extracting frames / features, running model(s)
            result = wrapper.run(profile_id=profile_id, video_path=saved_path, metadata=request.form.to_dict())
        else:
            payload = request.get_json(silent=True) or {}
            result = wrapper.run(profile_id=profile_id, payload=payload)

        # optionally call OpenRouter for an explainability / summary pass:
        # Construct a short prompt summarizing outputs and ask OpenRouter for an
        # explanation. (Server-side only)
        explanation = None
        try:
            or_prompt = wrapper.explain_prompt(result)
            if or_prompt:
                explanation = openrouter_explain(or_prompt)
        except Exception as e:
            logger.exception("OpenRouter explain error: %s", e)
            explanation = None

        response = {"model": model_key, "summary": result.get("summary", ""), "confidence": result.get("confidence", None), "details": result.get("details", {}), "explain": explanation}
        return jsonify(response)
    except Exception as e:
        logger.exception("Model %s failed", model_key)
        return jsonify({"error": "model failure", "details": str(e)}), 500


# === Model detail endpoint ===
@app.route("/api/profile/<int:profile_id>/models/<string:model_key>/detail", methods=["GET"])
def model_detail(profile_id: int, model_key: str):
    wrapper = MODEL_WRAPPERS.get(model_key)
    if not wrapper:
        return jsonify({"error": "Unknown model"}), 404
    try:
        metadata = wrapper.detail(profile_id=profile_id)
        return jsonify(metadata)
    except Exception as e:
        logger.exception("Model detail failure")
        return jsonify({"error": "detail failure", "details": str(e)}), 500


# === Reporting / endorsements / edit / badge endpoints ===
@app.route("/api/profile/<int:profile_id>/report", methods=["POST"])
def report_profile(profile_id: int):
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    # TODO: store report in DB / ticketing system. Notify admin.
    logger.info("REPORT for %s: %s", profile_id, text[:200])
    return jsonify({"ok": True}), 200


@app.route("/api/profile/<int:profile_id>/endorse", methods=["POST"])
def endorse_profile(profile_id: int):
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    # TODO: persist endorsement in DB
    logger.info("ENDORSE for %s: %s", profile_id, text[:200])
    return jsonify({"ok": True}), 200


@app.route("/api/profile/<int:profile_id>/edit-request", methods=["POST"])
def edit_request(profile_id: int):
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    logger.info("EDIT REQUEST for %s: %s", profile_id, text[:200])
    return jsonify({"ok": True}), 200


@app.route("/api/profile/<int:profile_id>/badge", methods=["POST"])
def award_badge(profile_id: int):
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    logger.info("AWARD BADGE for %s: %s", profile_id, title)
    return jsonify({"ok": True}), 200


# Optional: endpoint to stream model progress / logs (advanced)
@app.route("/api/profile/<int:profile_id>/models/<string:model_key>/stream", methods=["GET"])
def stream_model(profile_id: int, model_key: str):
    # Implement SSE or WebSocket for real-time progress feedback if you want.
    return jsonify({"error": "not implemented"}), 501

'''
# ================================================================
# ===================== SERVER ENTRY =============================
# ================================================================
if __name__ == "__main__":
    init_db()
    # run on 0.0.0.0 when in production behind reverse proxy; here keep debug for dev
    app.run(debug=True, host="127.0.0.1", port=5000)
