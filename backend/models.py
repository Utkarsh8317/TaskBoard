from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


project_members = db.Table(
    "project_members",
    db.Column("project_id", db.Integer, db.ForeignKey("project.id"), primary_key=True),
    db.Column("user_id", db.Integer, db.ForeignKey("user.id"), primary_key=True),
)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="Member")  # Admin/Member
    owned_projects = db.relationship("Project", backref="owner", lazy=True)
    assigned_tasks = db.relationship("Task", backref="assignee", lazy=True)
    member_projects = db.relationship(
        "Project",
        secondary=project_members,
        back_populates="members",
        lazy=True,
    )

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    tasks = db.relationship("Task", backref="project", lazy=True, cascade="all, delete-orphan")
    members = db.relationship(
        "User",
        secondary=project_members,
        back_populates="member_projects",
        lazy=True,
    )

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default="Pending")
    due_date = db.Column(db.Date)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
