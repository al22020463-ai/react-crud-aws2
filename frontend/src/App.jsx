import { useState, useEffect } from 'react'
import './App.css'

import { Authenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';

function App() {
  const [tareas, setTareas] = useState([]);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const API_URL = "https://kbi81twqv0.execute-api.us-east-1.amazonaws.com/tareas";

  const getHeaders = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      };
    } catch (error) {
      return { "Content-Type": "application/json" };
    }
  };

  const obtenerTareas = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setTareas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error obteniendo tareas:", error);
    }
  };

  const manejarAccion = async () => {
    if (!nuevaTarea.trim()) return;
    const metodo = editandoId ? "PUT" : "POST";
    // Al crear una nueva, por defecto completada es false
    const body = editandoId 
      ? { id: editandoId, info: nuevaTarea } 
      : { info: nuevaTarea, completada: false };

    await fetch(API_URL, {
      method: metodo,
      headers: await getHeaders(), 
      body: JSON.stringify(body),
    });

    setNuevaTarea("");
    setEditandoId(null);
    obtenerTareas();
  };

  // NUEVA FUNCIÓN: Mueve la tarea entre Pendientes y Realizados
  const alternarEstado = async (tarea) => {
    const nuevoEstado = !tarea.completada;
    await fetch(API_URL, {
      method: "PUT",
      headers: await getHeaders(),
      body: JSON.stringify({ 
        id: tarea.id, 
        info: tarea.info, 
        completada: nuevoEstado 
      }),
    });
    obtenerTareas();
  };

  const eliminarTarea = async (id) => {
    await fetch(API_URL, {
      method: "DELETE",
      headers: await getHeaders(),
      body: JSON.stringify({ id }),
    });
    obtenerTareas();
  };

  useEffect(() => { 
    obtenerTareas(); 
  }, []);

  // Filtrado de listas
  const pendientes = tareas.filter(t => !t.completada);
  const realizadas = tareas.filter(t => t.completada);

  return (
    <Authenticator.Provider>
      <div className="App">
        <header>
          <h1>Mis Tareas en AWS</h1>
        </header>
        <div className="separator"></div>

        <Authenticator>
          {({ signOut, user }) => (
            <main className="auth-card-container">
              
              <div className="user-info-panel">
                <span className="user-email">Bienvenido, <b>{user.signInDetails?.loginId}</b></span>
                <button onClick={signOut} className="btn-logout">Cerrar Sesión</button>
              </div>

              <div className="input-group">
                <input 
                  className="task-input"
                  value={nuevaTarea} 
                  onChange={(e) => setNuevaTarea(e.target.value)} 
                  placeholder="¿Qué tarea tienes pendiente?" 
                />
                <button onClick={manejarAccion} className="btn-primary-action">
                  {editandoId ? "Guardar" : "Agregar"}
                </button>
              </div>
              
              <div className="dashboard-tareas">
                {/* --- RECUADRO PENDIENTES --- */}
                <div className="column-tareas">
                  <h3>📌 Pendientes ({pendientes.length})</h3>
                  <ul className="task-list-display">
                    {pendientes.map(t => (
                      <li key={t.id} className="task-item-card">
                        <span className="task-content-text">{t.info}</span>
                        <div className="task-actions-group">
                          <button onClick={() => alternarEstado(t)} className="btn-icon" title="Marcar como realizada">✅</button>
                          <button onClick={() => {setNuevaTarea(t.info); setEditandoId(t.id);}} className="btn-icon">✏️</button>
                          <button onClick={() => eliminarTarea(t.id)} className="btn-icon">🗑️</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* --- RECUADRO REALIZADOS --- */}
                <div className="column-tareas">
                  <h3>🏁 Realizados ({realizadas.length})</h3>
                  <ul className="task-list-display completed-list">
                    {realizadas.map(t => (
                      <li key={t.id} className="task-item-card task-completed">
                        <span className="task-content-text">{t.info}</span>
                        <div className="task-actions-group">
                          <button onClick={() => alternarEstado(t)} className="btn-icon" title="Desmarcar">🔄</button>
                          <button onClick={() => eliminarTarea(t.id)} className="btn-icon">🗑️</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </main>
          )}
        </Authenticator>
      </div>
    </Authenticator.Provider>
  );
}

export default App;