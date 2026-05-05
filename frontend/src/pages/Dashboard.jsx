import { useEffect, useState } from "react";
import api from "../api";

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    api.get("/dashboard").then((res) => setTasks(res.data));
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <ul>
        {tasks.map((t) => (
          <li key={t.id}>{t.title} - {t.status}</li>
        ))}
      </ul>
    </div>
  );
}
