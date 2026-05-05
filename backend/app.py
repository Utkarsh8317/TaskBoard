from datetime import date, datetime
import os

from flask import Flask, jsonify, request, send_from_directory
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config
from models import Project, Task, User, db, project_members

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

db.init_app(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

with app.app_context():
    db.create_all()

VALID_ROLES = {"Admin", "Member"}
VALID_STATUSES = {"Pending", "In Progress", "Done"}


def error_response(message, code=400):
    return jsonify({"error": message}), code


def parse_iso_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def user_to_dict(user):
    return {"id": user.id, "username": user.username, "role": user.role}


def task_to_dict(task):
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description or "",
        "status": task.status,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "project_id": task.project_id,
        "assigned_to": task.assigned_to,
        "assigned_to_user": task.assignee.username if task.assignee else None,
        "is_overdue": bool(task.due_date and task.status != "Done" and task.due_date < date.today()),
    }


def project_to_dict(project):
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description or "",
        "owner": user_to_dict(project.owner),
        "members": [user_to_dict(member) for member in project.members],
        "task_count": len(project.tasks),
    }


def get_current_user():
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None
    return db.session.get(User, user_id)


@app.route("/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    role = (data.get("role") or "Member").strip()

    if len(username) < 3:
        return error_response("Username must be at least 3 characters.")
    if len(password) < 6:
        return error_response("Password must be at least 6 characters.")
    if role not in VALID_ROLES:
        return error_response("Role must be Admin or Member.")
    if User.query.filter_by(username=username).first():
        return error_response("Username already exists.", 409)

    user = User(username=username, password=generate_password_hash(password), role=role)
    db.session.add(user)
    db.session.commit()
    return jsonify({"msg": "User created", "user": user_to_dict(user)}), 201


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return error_response("Username and password are required.")

    user = User.query.filter_by(username=username).first()
    password_ok = False
    if user:
        # Supports current werkzeug hashes and older bcrypt hashes.
        password_ok = check_password_hash(user.password, password)
        if not password_ok and user.password.startswith("$2"):
            try:
                password_ok = bcrypt.check_password_hash(user.password, password)
                if password_ok:
                    # Upgrade legacy bcrypt hash to current default hash.
                    user.password = generate_password_hash(password)
                    db.session.commit()
            except ValueError:
                password_ok = False

    if user and password_ok:
        token = create_access_token(identity=str(user.id))
        return jsonify({"token": token, "user": user_to_dict(user)})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/auth/me", methods=["GET"])
@jwt_required()
def me():
    user = get_current_user()
    if not user:
        return error_response("User not found.", 404)
    return jsonify({"user": user_to_dict(user)})


@app.route("/users", methods=["GET"])
@jwt_required()
def list_users():
    users = User.query.order_by(User.username.asc()).all()
    return jsonify([user_to_dict(user) for user in users])


@app.route("/projects", methods=["GET"])
@jwt_required()
def list_projects():
    user = get_current_user()
    if user.role == "Admin":
        projects = Project.query.order_by(Project.id.desc()).all()
    else:
        projects = user.member_projects
    return jsonify([project_to_dict(project) for project in projects])


@app.route("/projects", methods=["POST"])
@jwt_required()
def create_project():
    user = get_current_user()
    if user.role != "Admin":
        return error_response("Admin access required.", 403)

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    if len(name) < 3:
        return error_response("Project name must be at least 3 characters.")

    project = Project(name=name, description=description, owner_id=user.id)
    project.members.append(user)
    db.session.add(project)
    db.session.commit()
    return jsonify({"msg": "Project created", "project": project_to_dict(project)}), 201


@app.route("/projects/<int:project_id>/members", methods=["POST"])
@jwt_required()
def add_project_member(project_id):
    user = get_current_user()
    if user.role != "Admin":
        return error_response("Admin access required.", 403)

    project = db.session.get(Project, project_id)
    if not project:
        return error_response("Project not found.", 404)

    data = request.get_json(silent=True) or {}
    member_id_raw = data.get("user_id")
    if member_id_raw in (None, ""):
        return error_response("user_id is required.")
    try:
        member_id = int(member_id_raw)
    except (TypeError, ValueError):
        return error_response("user_id must be a valid integer.")

    member = db.session.get(User, member_id)
    if not member:
        return error_response("User not found.", 404)
    if member in project.members:
        return error_response("User is already in this project.")

    project.members.append(member)
    db.session.commit()
    return jsonify({"msg": "Member added", "project": project_to_dict(project)})


@app.route("/tasks", methods=["GET"])
@jwt_required()
def list_tasks():
    user = get_current_user()
    project_id = request.args.get("project_id", type=int)
    query = Task.query
    if user.role == "Member":
        query = query.join(Project).join(project_members, project_members.c.project_id == Project.id)
        query = query.filter(project_members.c.user_id == user.id)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    tasks = query.order_by(Task.id.desc()).all()
    return jsonify([task_to_dict(task) for task in tasks])


@app.route("/tasks", methods=["POST"])
@jwt_required()
def create_task():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    status = (data.get("status") or "Pending").strip()
    project_id = data.get("project_id")
    assigned_to = data.get("assigned_to")
    due_date = parse_iso_date(data.get("due_date"))

    if len(title) < 3:
        return error_response("Task title must be at least 3 characters.")
    if status not in VALID_STATUSES:
        return error_response("Invalid status.")
    if not project_id or not assigned_to:
        return error_response("project_id and assigned_to are required.")
    if data.get("due_date") and not due_date:
        return error_response("due_date must be in YYYY-MM-DD format.")

    project = db.session.get(Project, project_id)
    assignee = db.session.get(User, assigned_to)
    if not project:
        return error_response("Project not found.", 404)
    if not assignee:
        return error_response("Assigned user not found.", 404)
    if user.role != "Admin":
        return error_response("Only admins can create tasks.", 403)
    if assignee not in project.members:
        project.members.append(assignee)

    task = Task(
        title=title,
        description=description,
        status=status,
        due_date=due_date,
        project_id=project_id,
        assigned_to=assigned_to,
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"msg": "Task created", "task": task_to_dict(task)}), 201


@app.route("/tasks/<int:task_id>", methods=["PATCH"])
@jwt_required()
def update_task(task_id):
    user = get_current_user()
    task = db.session.get(Task, task_id)
    if not task:
        return error_response("Task not found.", 404)

    project = db.session.get(Project, task.project_id)
    can_manage = user.role == "Admin" or project.owner_id == user.id
    is_assignee = task.assigned_to == user.id
    if not can_manage and not is_assignee:
        return error_response("Not allowed to update this task.", 403)

    data = request.get_json(silent=True) or {}
    if "status" in data:
        status = (data.get("status") or "").strip()
        if status not in VALID_STATUSES:
            return error_response("Invalid status.")
        task.status = status

    if can_manage:
        if "title" in data:
            title = (data.get("title") or "").strip()
            if len(title) < 3:
                return error_response("Task title must be at least 3 characters.")
            task.title = title
        if "description" in data:
            task.description = (data.get("description") or "").strip()
        if "assigned_to" in data:
            assignee = db.session.get(User, data.get("assigned_to"))
            if not assignee:
                return error_response("Assigned user not found.", 404)
            if assignee not in project.members:
                return error_response("Assigned user must be a project member.")
            task.assigned_to = assignee.id
        if "due_date" in data:
            if data.get("due_date") in (None, ""):
                task.due_date = None
            else:
                parsed = parse_iso_date(data.get("due_date"))
                if not parsed:
                    return error_response("due_date must be in YYYY-MM-DD format.")
                task.due_date = parsed

    db.session.commit()
    return jsonify({"msg": "Task updated", "task": task_to_dict(task)})


@app.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    user = get_current_user()
    if user.role == "Admin":
        tasks = Task.query.all()
    else:
        tasks = (
            Task.query.join(Project)
            .join(project_members, project_members.c.project_id == Project.id)
            .filter(project_members.c.user_id == user.id)
            .all()
        )
    total = len(tasks)
    done = len([t for t in tasks if t.status == "Done"])
    in_progress = len([t for t in tasks if t.status == "In Progress"])
    pending = len([t for t in tasks if t.status == "Pending"])
    overdue = len([t for t in tasks if t.due_date and t.status != "Done" and t.due_date < date.today()])
    return jsonify(
        {
            "summary": {
                "total": total,
                "done": done,
                "in_progress": in_progress,
                "pending": pending,
                "overdue": overdue,
            },
            "tasks": [task_to_dict(task) for task in tasks],
        }
    )


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith(("auth", "users", "projects", "tasks", "dashboard")):
        return error_response("Not found.", 404)
    file_path = os.path.join(FRONTEND_DIST, path)
    if path and os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIST, path)
    return send_from_directory(FRONTEND_DIST, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
