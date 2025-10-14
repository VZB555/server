const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// === SERVEUR HTTP POUR LE FRONTEND ===
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`Serveur web en ligne sur http://localhost:${PORT}`);
});

// === SERVEUR WEBSOCKET ===
const browsers = {};   // { mac: [WebSocket, WebSocket...] }


const wss = new WebSocket.Server({ server });

// Gestion des connexions
let arduinoSocket = null; // stocke la connexion Arduino
let clients = []; // liste des navigateurs connectés
let lastSensorUpdateTime = null;
let lastVersion = null; 

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

/* NEW */ 	

        if (!mac) return console.error("Browser sans MAC !");
        if (!browsers[mac]) browsers[mac] = [];
        browsers[mac].push(ws);

        console.log(`🧭 Navigateur connecté pour Arduino ${mac}`);
   //   ws.send(JSON.stringify({ type: 'server', msg: `Navigateur lié à ${mac}` }));	
	  
/* FIN NEW */ 		  
		  
        clients.push(ws);
        console.log("Navigateur connecté 2 !");
        ws.send(JSON.stringify({ type: 'server', payload: 'Navigateur connecté au serveur' }));
	
      }

      // Message de l'Arduino → envoyer à tous les navigateurs
      else if (data.type === 'sensor_update') {
		  
		/* TELEGRAM */
		if (data.ring === 1) {
			const BOT_TOKEN = "8211651169:AAEZWvA_ShQErMaTytB5f5vH_dBorDDj0ng";   // ton token BotFather
			const CHAT_ID = "578740783";          // ton chat_id
			const MESSAGE = "Sonnerie a Nordmann";
			
			fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
			  chat_id: CHAT_ID,
			  text: MESSAGE
			})
		  })
		  
		  console.log("Message Telegram Sonnerie");  
		}
		/* FIN TELEGRAM */
		  
		arduinoSocket = ws;
		
		lastVersion = data.V;
		lastSensorUpdateTime = new Date().toISOString();
		
		console.log(data.mac + ' - sensor_update' + ' - ' + lastSensorUpdateTime);  
		console.log(data.mac + ' - ' + data.Com   + ' - ' + data.Temp + ' - ' + data.V);
		console.log(data.mac + ' - ' + data.Ack   + ' - ' + data.ring );
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
			console.log("envoi de la Mac addreess au browser");
            client.send(JSON.stringify({ type: 'arduino_data', mac: data.mac , V: lastVersion , Ack: data.Ack, lastUpdate: lastSensorUpdateTime }));
          }
        });
		
		arduinoSocket.send(JSON.stringify({ type: 'command', payload: 'recu du server' }));
      }

      // Message du navigateur → envoyer à l'Arduino
      else if (data.type === 'command') {
		console.log("message du brower recu 1");
		console.log(arduinoSocket.readyState);
        if (arduinoSocket && arduinoSocket.readyState === WebSocket.OPEN) {
          console.log("message du brower recu 2");
		  console.log(data.payload);
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