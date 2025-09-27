const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 3000;

// === SERVEUR HTTP POUR LE FRONTEND ===
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`Serveur web en ligne sur http://localhost:${PORT}`);
});

// === SERVEUR WEBSOCKET ===
const wss = new WebSocket.Server({ server });

// Gestion des connexions
let arduinoSocket = null; // stocke la connexion Arduino
let clients = []; // liste des navigateurs connectés

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Nouvelle connexion depuis ${ip}`);

  // Identification du type de client (Arduino ou Frontend)
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Identification Arduino
      if (data.type === 'arduino') {
        arduinoSocket = ws;
        console.log("Arduino connecté !");
        ws.send(JSON.stringify({ type: 'server', msg: 'Arduino connecté au serveur' }));
      }

      // Identification Frontend
      else if (data.type === 'browser') {
        clients.push(ws);
        console.log("Navigateur connecté !");
        ws.send(JSON.stringify({ type: 'server', msg: 'Navigateur connecté au serveur' }));
      }

      // Message de l'Arduino → envoyer à tous les navigateurs
      else if (data.type === 'sensor_update') {
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'arduino_data', payload: data.payload }));
          }
        });
      }

      // Message du navigateur → envoyer à l'Arduino
      else if (data.type === 'command') {
        if (arduinoSocket && arduinoSocket.readyState === WebSocket.OPEN) {
          arduinoSocket.send(JSON.stringify({ type: 'command', payload: data.payload }));
        }
      }

    } catch (e) {
      console.error("Erreur de parsing message :", e);
    }
  });

  // Gestion des déconnexions
  ws.on('close', () => {
    console.log("Client déconnecté");
    clients = clients.filter(client => client !== ws);
    if (ws === arduinoSocket) {
      arduinoSocket = null;
      console.log("Arduino déconnecté !");
    }
  });
});