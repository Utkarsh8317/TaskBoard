import { useEffect, useMemo, useState } from "react";
import api from "./api";

const initialTaskForm = {
  title: "",
  description: "",
  status: "Pending",
  due_date: "",
  project_id: "",
  assigned_to: "",
};

export default function App() {
  const [mode, setMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", role: "Member" });
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total: 0, done: 0, in_progress: 0, pending: 0, overdue: 0 });
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [memberForm, setMemberForm] = useState({ project_id: "", user_id: "" });
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [statusError, setStatusError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const isAdmin = currentUser?.role === "Admin";

  const projectMembers = useMemo(() => {
    const selected = projects.find((project) => String(project.id) === String(taskForm.project_id));
    return selected?.members || [];
  }, [projects, taskForm.project_id]);
  const assignableMembers = useMemo(() => {
    if (isAdmin) return users;
    return projectMembers;
  }, [isAdmin, users, projectMembers]);

  const showMessage = (message, isError = false) => {
    if (isError) {
      setStatusError(message);
      setStatusMessage("");
    } else {
      setStatusMessage(message);
      setStatusError("");
    }
  };

  const safeError = (error) =>
    error?.response?.data?.error || error?.response?.data?.msg || "Request failed. Please try again.";

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setCurrentUser(null);
    showMessage("Logged out.");
  };

  const loadBoardData = async () => {
    const [meRes, usersRes, projectsRes, tasksRes, dashboardRes] = await Promise.all([
      api.get("/auth/me"),
      api.get("/users"),
      api.get("/projects"),
      api.get("/tasks"),
      api.get("/dashboard"),
    ]);
    setCurrentUser(meRes.data.user);
    setUsers(usersRes.data);
    setProjects(projectsRes.data);
    setTasks(tasksRes.data);
    setSummary(dashboardRes.data.summary);
  };

  useEffect(() => {
    if (!token) return;
    loadBoardData().catch((error) => {
      showMessage(safeError(error), true);
      if (error?.response?.status === 401 || error?.response?.status === 422) logout();
    });
  }, [token]);

  const handleAuthChange = (field, value) => setAuthForm((prev) => ({ ...prev, [field]: value }));

  const submitLogin = async () => {
    if (authForm.username.trim().length < 3 || authForm.password.length < 6) {
      showMessage("Username (3+) and password (6+) are required.", true);
      return;
    }
    try {
      const response = await api.post("/auth/login", {
        username: authForm.username.trim(),
        password: authForm.password,
      });
      localStorage.setItem("token", response.data.token);
      setToken(response.data.token);
      setAuthForm({ username: "", password: "", role: "Member" });
      showMessage("Login successful.");
    } catch (error) {
      showMessage(safeError(error), true);
    }
  };

  const submitSignup = async () => {
    if (authForm.username.trim().length < 3 || authForm.password.length < 6) {
      showMessage("Username (3+) and password (6+) are required.", true);
      return;
    }
    try {
      await api.post("/auth/signup", {
        username: authForm.username.trim(),
        password: authForm.password,
        role: authForm.role,
      });
      showMessage("Signup successful. You can now login.");
      setMode("login");
    } catch (error) {
      showMessage(safeError(error), true);
    }
  };

  const createProject = async () => {
    if (projectForm.name.trim().length < 3) {
      showMessage("Project name must be at least 3 characters.", true);
      return;
    }
    try {
      await api.post("/projects", {
        name: projectForm.name.trim(),
        description: projectForm.description.trim(),
      });
      setProjectForm({ name: "", description: "" });
      await loadBoardData();
      showMessage("Project created.");
    } catch (error) {
      showMessage(safeError(error), true);
    }
  };

  const addMember = async () => {
    if (!memberForm.project_id || !memberForm.user_id) {
      showMessage("Select project and user.", true);
      return;
    }
    try {
      await api.post(`/projects/${memberForm.project_id}/members`, {
        user_id: Number(memberForm.user_id),
      });
      setMemberForm({ project_id: "", user_id: "" });
      await loadBoardData();
      showMessage("Member added to project.");
    } catch (error) {
      showMessage(safeError(error), true);
    }
  };

  const refreshBoard = async () => {
    try {
      await loadBoardData();
      showMessage("Project members refreshed.");
    } catch (error) {
      showMessage(safeError(error), true);
    }
  };

  const createTask = async () => {
    if (taskForm.title.trim().length < 3) {
      showMessage("Task title must be at least 3 characters.", true);
      return;
    }
    if (!taskForm.project_id || !taskForm.assigned_to) {
      showMessage("Select project and assignee.", true);
      return;
    }
    try {
      await api.post("/tasks", {
        ...taskForm,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        project_id: Number(taskForm.project_id),
        assigned_to: Number(taskForm.assigned_to),
        due_date: taskForm.due_date || null,
      });
      setTaskForm(initialTaskForm);
      await loadBoardData();
      showMessage("Task created.");
    } catch (error) {
      showMessage(safeError(error), true);
    }
  };

  const updateTaskStatus = async (taskId, nextStatus) => {
    setStatusError("");
    try {
      await api.patch(`/tasks/${taskId}`, { status: nextStatus });
      await loadBoardData();
      showMessage("Task status updated.");
    } catch (error) {
      showMessage(safeError(error), true);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="card">
          <h1>Task Assignment Board</h1>
          <p className="sub">Fast project and task tracking for Admin and Member roles.</p>
          <div className="tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Signup</button>
          </div>
          <input
            placeholder="Username"
            value={authForm.username}
            onChange={(event) => handleAuthChange("username", event.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={authForm.password}
            onChange={(event) => handleAuthChange("password", event.target.value)}
          />
          {mode === "signup" && (
            <select value={authForm.role} onChange={(event) => handleAuthChange("role", event.target.value)}>
              <option>Member</option>
              <option>Admin</option>
            </select>
          )}
          <button onClick={mode === "login" ? submitLogin : submitSignup}>
            {mode === "login" ? "Login" : "Create account"}
          </button>
          {statusError && <p className="error">{statusError}</p>}
          {statusMessage && <p className="ok">{statusMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="board">
      <header className="topbar">
        <div>
          <h2>Welcome, {currentUser?.username}</h2>
          <p className="sub">Role: {currentUser?.role}</p>
        </div>
        <button className="secondary" onClick={logout}>Logout</button>
      </header>

      <section className="stats">
        <Stat label="Total" value={summary.total} />
        <Stat label="Done" value={summary.done} />
        <Stat label="In Progress" value={summary.in_progress} />
        <Stat label="Pending" value={summary.pending} />
        <Stat label="Overdue" value={summary.overdue} />
      </section>

      {isAdmin && (
        <section className="grid two">
          <div className="panel">
            <h3>Create Project</h3>
            <input
              placeholder="Project name"
              value={projectForm.name}
              onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <textarea
              placeholder="Description"
              value={projectForm.description}
              onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))}
            />
            <button onClick={createProject}>Create project</button>
          </div>

          <div className="panel">
            <h3>Add Member to Project</h3>
            <select
              value={memberForm.project_id}
              onChange={(event) => setMemberForm((prev) => ({ ...prev, project_id: event.target.value }))}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <select
              value={memberForm.user_id}
              onChange={(event) => setMemberForm((prev) => ({ ...prev, user_id: event.target.value }))}
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} ({user.role})
                </option>
              ))}
            </select>
            <button onClick={addMember}>Add member</button>
            <button className="secondary full" onClick={refreshBoard}>Refresh members</button>
            {memberForm.project_id && (
              <div className="live-members">
                <small>Current members in selected project:</small>
                <p>
                  {(projects.find((project) => String(project.id) === String(memberForm.project_id))?.members || [])
                    .map((member) => `${member.username} (${member.role})`)
                    .join(", ") || "No users yet"}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="panel">
          <h3>Create Task</h3>
          <div className="live-members">
            <small>{isAdmin ? "Assignable users:" : "Project members:"}</small>
            <p>
              {taskForm.project_id
                ? assignableMembers.map((member) => `${member.username} (${member.role})`).join(", ") || "No users in selected project"
                : "Select a project to view member names"}
            </p>
          </div>
          {projects.length === 0 ? (
            <p className="sub">First create a project, then you can create tasks.</p>
          ) : (
            <>
              <div className="grid three">
                <input
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                />
                <select
                  value={taskForm.project_id}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, project_id: event.target.value, assigned_to: "" }))}
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
                <select
                  value={taskForm.assigned_to}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, assigned_to: event.target.value }))}
                >
                  <option value="">Assign to user</option>
                  {assignableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.username} ({member.role})
                    </option>
                  ))}
                </select>
                <select
                  value={taskForm.status}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Done</option>
                </select>
                <input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, due_date: event.target.value }))}
                />
                <button onClick={createTask}>Create task</button>
              </div>
              <textarea
                placeholder="Task description"
                value={taskForm.description}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              {taskForm.project_id && assignableMembers.length === 0 && (
                <p className="sub">No user in this project yet. Add users first, then assign task.</p>
              )}
              {isAdmin && taskForm.project_id && (
                <p className="sub">If selected user is not in this project, they will be added automatically.</p>
              )}
            </>
          )}
        </section>
      )}

      <section className="panel">
        <h3>{isAdmin ? "All Projects" : "My Projects"}</h3>
        {projects.length === 0 ? (
          <p className="sub">
            {isAdmin
              ? "No projects created yet."
              : "No project assigned yet. Ask Admin to add you to a project."}
          </p>
        ) : (
          <div className="task-list">
            {projects.map((project) => (
              <div className="task" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.description || "No description"}</p>
                  <small>
                    Owner: {project.owner?.username || "N/A"} | Tasks: {project.task_count}
                  </small>
                </div>
                <div className="task-actions">
                  <small>Members</small>
                  <p>
                    {(project.members || []).map((member) => member.username).join(", ") || "None"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Tasks</h3>
        <div className="task-list">
          {tasks.length === 0 && <p className="sub">No tasks found.</p>}
          {tasks.map((task) => (
            <div className="task" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p>{task.description || "No description"}</p>
                <small>
                  Project #{task.project_id} | Assigned: {task.assigned_to === currentUser?.id ? "Me" : (task.assigned_to_user || task.assigned_to)} | Due: {task.due_date || "N/A"}
                </small>
              </div>
              <div className="task-actions">
                <span className={`badge ${task.status.replace(" ", "-").toLowerCase()}`}>{task.status}</span>
                <select
                  value={task.status}
                  onChange={(event) => updateTaskStatus(task.id, event.target.value)}
                >
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Done</option>
                </select>
                {task.is_overdue && <span className="overdue">Overdue</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {statusError && <p className="error">{statusError}</p>}
      {statusMessage && <p className="ok">{statusMessage}</p>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}