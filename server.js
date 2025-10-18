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

const arduinos = {};   // { mac: WebSocket }
const browsers = {};   // { mac: [WebSocket, WebSocket...] }

const temperatures = {};  
const lasttimearduinoconnect = {};  

const wss = new WebSocket.Server({ server });

// Gestion des connexions
// let arduinoSocket = null;
//let clients = []; // liste des navigateurs connectés
let lastSensorUpdateTime = null;
let lastVersion = null; 

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Nouvelle connexion depuis ${ip}`);

  // Identification du type de client (Arduino ou Frontend)
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
	   console.log("data.type = " + data.type);

      // Identification Arduino
      if (data.type === 'arduino') {
/* NEW */
		if (!data.mac) return console.error("Arduino sans MAC !");
        arduinos[data.mac] = ws;
        console.log(`🔌 Arduino START : ${data.mac}`);		
/* FIN NEW */		
		temperatures[data.mac] = data.Temp;  
		lasttimearduinoconnect[data.mac] = new Date().toISOString();
		
//        arduinoSocket = ws;
        console.log('Arduino connecté nouveau format: ' , data.mac );
        ws.send(JSON.stringify({ type: 'server', payload: 'Arduino connecté au serveur' }));
      }

      // Identification Frontend
      else if (data.type === 'browser') {

/* NEW */ 	

        if (!data.mac) return console.error("Browser sans MAC !");
        if (!browsers[data.mac]) browsers[data.mac] = [];
        browsers[data.mac].push(ws);

        console.log(`🧭 Navigateur connecté pour Arduino ${data.mac}`);
        ws.send(JSON.stringify({ type: 'server', Temp: temperatures[data.mac] , lastUpdate: lasttimearduinoconnect[data.mac]  }));	
	  
/* FIN NEW */ 		  
/*		  
        clients.push(ws);
        console.log("Navigateur connecté 2 !");
        ws.send(JSON.stringify({ type: 'server', payload: 'Navigateur connecté au serveur' }));
*/	
      }

      // Message de l'Arduino → envoyer à tous les navigateurs
      else if (data.type === 'sensor_update') {
		  
		/* TELEGRAM */
		if (data.Com === 'ring' ) {
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

        temperatures[data.mac] = data.Temp;

		lastVersion = data.V;
		lastSensorUpdateTime = new Date().toISOString();
		lasttimearduinoconnect[data.mac] = new Date().toISOString();
		
		console.log(data.mac + ' - sensor_update' + ' - ' + lastSensorUpdateTime);  
		console.log(data.mac + ' - ' + data.Com   + ' - ' + data.Temp + ' - ' + data.V);
		console.log(data.mac + ' - ' + data.Ack   + ' - ' + data.ring );
        
		 // Envoi aux browsers liés à ce MAC
        if (browsers[data.mac]) {
          browsers[data.mac].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
               client.send(JSON.stringify({ type: 'arduino_data', mac: data.mac , V: lastVersion , Ack: data.Ack, lastUpdate: lastSensorUpdateTime, Temp: temperatures[data.mac]  })); 
			}
		  });
        }
		
		ws.send(JSON.stringify({ type: 'command', payload: 'OK reçu du serveur' }));
        return;
/* OLD		
		arduinoSocket = ws;
		
		clients.forEach(client => {
        		if (client.readyState === WebSocket.OPEN) {
			console.log("envoi de la Mac addreess au browser");
            client.send(JSON.stringify({ type: 'arduino_data', mac: data.mac , V: lastVersion , Ack: data.Ack, lastUpdate: lastSensorUpdateTime }));
          }
        });
		
		arduinoSocket.send(JSON.stringify({ type: 'command', payload: 'recu du server' }));
FIN OLD */		
      }

      // Message du navigateur → envoyer à l'Arduino
      else if (data.type === 'command') {
	
		if (!data.mac || !arduinos[data.mac]) {
			console.log("⚠️ Arduino introuvable pour", data.mac);
			return;
		}
        const target = arduinos[data.mac];
        if (target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify({ type: 'command', payload: data.payload }));
          console.log(`💬 Commande envoyée à ${data.mac}:`, data.payload);
        }
        return;
    }	

/* OLD  		  
		console.log("message du brower recu 1");
		console.log(arduinoSocket.readyState);
        if (arduinoSocket && arduinoSocket.readyState === WebSocket.OPEN) {
          console.log("message du brower recu 2");
		  console.log(data.payload);
		  arduinoSocket.send(JSON.stringify({ type: 'command', payload: data.payload }));
        }

	}
FIN OLD */
	  

	  
	  

    }
	catch (e) {
      console.error("Erreur de parsing message :", e);
    }
  });

  // Gestion des déconnexions
  ws.on('close', () => {
    console.log("Client déconnecté");
//    clients = clients.filter(client => client !== ws);
/*    
	if (ws === arduinoSocket) {
      arduinoSocket = null;
      console.log("Arduino déconnecté !");
    }
*/	
	for (const [mac, socket] of Object.entries(arduinos)) {
      if (socket === ws) {
        console.log(`❌ Arduino déconnecté : ${mac}`);
        delete arduinos[mac];
      }
    }
	
	for (const [mac, list] of Object.entries(browsers)) {
      browsers[mac] = list.filter(c => c !== ws);
      if (browsers[mac].length === 0) {
        console.log("BROWSER_DECONNECT" + mac);		
		delete browsers[mac];
	  }
    }
	
  });
});