import { useState, useEffect } from 'react'
import './App.css'

// 1. Importaciones de AWS Amplify
import { Amplify } from 'aws-amplify'; // Asegúrate de tener esta import
import { Authenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';

// --- PEGA AQUÍ TU Amplify.configure({ ... }) ---

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
    
    // Si estamos editando, buscamos la tarea original para no perder su estado 'completed'
    const tareaOriginal = editandoId ? tareas.find(t => t.id === editandoId) : null;
    
    const body = editandoId 
      ? { id: editandoId, info: nuevaTarea, completed: tareaOriginal?.completed || false } 
      : { info: nuevaTarea, completed: false };

    await fetch(API_URL, {
      method: metodo,
      headers: await getHeaders(), 
      body: JSON.stringify(body),
    });

    setNuevaTarea("");
    setEditandoId(null);
    obtenerTareas();
  };

  // --- NUEVA FUNCIÓN: MARCAR / DESMARCAR COMPLETADO ---
  const marcarCompletado = async (tarea) => {
    const body = { 
      id: tarea.id, 
      info: tarea.info, 
      completed: !tarea.completed // Cambiamos el estado actual
    };

    await fetch(API_URL, {
      method: "PUT",
      headers: await getHeaders(),
      body: JSON.stringify(body),
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
                <span className="user-email">Hola, <b>{user.signInDetails?.loginId}</b></span>
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
              
              <ul className="task-list-display">
                {tareas.map(t => (
                  <li key={t.id} className="task-item-card">
                    {/* CASILLA DE VERIFICACIÓN */}
                    <input 
                      type="checkbox"
                      className="task-checkbox"
                      checked={t.completed || false}
                      onChange={() => marcarCompletado(t)}
                    />

                    {/* TEXTO DE LA TAREA (Con estilo condicional) */}
                    <span className={`task-content-text ${t.completed ? 'completed' : ''}`}>
                      {t.info}
                    </span>

                    <div className="task-actions-group">
                      <button onClick={() => {setNuevaTarea(t.info); setEditandoId(t.id);}} className="btn-icon">✏️</button>
                      <button onClick={() => eliminarTarea(t.id)} className="btn-icon">🗑️</button>
                    </div>
                  </li>
                ))}
                {tareas.length === 0 && (
                  <p className="no-tasks-msg">No hay tareas pendientes.</p>
                )}
              </ul>
            </main>
          )}
        </Authenticator>
      </div>
    </Authenticator.Provider>
  );
}

export default App;