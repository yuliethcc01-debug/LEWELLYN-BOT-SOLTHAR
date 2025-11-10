import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import * as qrcode from 'qrcode';
import * as fs from 'fs';
import http from 'http';
import fetch from 'node-fetch';

const HEALTHCHECK_URL = 'https://hc-ping.com/16eaeca4-4ae8-441e-bc82-fe7f50a94478';

function sendHeartbeat() {
  fetch(HEALTHCHECK_URL)
    .then(response => {
      if (response.status === 200) {
        console.log('💚 Heartbeat enviado correctamente. Bot activo y protegido.');
      } else {
        console.error(`💔 Error al enviar Heartbeat. Código: ${response.status}`);
      }
    })
    .catch(error => {
      console.error('💔 Error de red al enviar Heartbeat:', error.message);
    });
}

if (fs.existsSync('./auth_info_baileys')) {
  console.log('🚨 Limpiando sesión auth_info_baileys para nuevo despliegue...');
  fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [ERROR FATAL] Unhandled Rejection:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ [ERROR FATAL] Uncaught Exception:', error);
});

const port = process.env.PORT || 8000;

function getEconomyData() {
  try {
    if (!fs.existsSync('./economy.json')) {
      fs.writeFileSync('./economy.json', JSON.stringify({}, null, 2));
    }
    const data = fs.readFileSync('./economy.json', 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Error leyendo economy.json:", e);
    return {};
  }
}

function saveEconomyData(data) {
  try {
    fs.writeFileSync('./economy.json', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error guardando economy.json:", e);
  }
}

const COOLDOWN_FILE = './cooldowns.json';

function getSalaryCooldownData() {
  try {
    if (!fs.existsSync(COOLDOWN_FILE)) {
      fs.writeFileSync(COOLDOWN_FILE, JSON.stringify({}, null, 4));
      return {};
    }
    const data = fs.readFileSync(COOLDOWN_FILE, 'utf8');
    if (!data || data.trim().length === 0) {
      console.warn("ADVERTENCIA: cooldowns.json está vacío. Reiniciando con {}");
      return {};
    }
    return JSON.parse(data);
  } catch (e) {
    console.error("ERROR GRAVE leyendo cooldowns.json:", e.message);
    return {};
  }
}

function saveSalaryCooldownData(data) {
  try {
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(data, null, 4));
  } catch (e) {
    console.error("Error guardando cooldowns.json:", e);
  }
}

const sessionName = 'auth_info_baileys';
const prefix = '#';

const SALARY_AMOUNT = 4;
const SALARY_COOLDOWN_MS = 48 * 60 * 60 * 1000;

async function startGaaraBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);

    const sock = makeWASocket({
      auth: state,
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Lewellyn-Dairelle', 'Safari', '1.0.0']
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        await qrcode.toFile('./qr.svg', qr, { type: 'svg' });
        console.log('🚨 Se necesita escanear el QR. QR generado en la ruta /qr.svg');
      }

      if (connection === 'close') {
        let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        let isLoggedOut = reason === DisconnectReason.loggedOut;
        let shouldReconnect = !isLoggedOut;

        console.log(`🔴 Conexión cerrada. Razón: ${reason}, LoggedOut: ${isLoggedOut}`);

        if (shouldReconnect) {
          console.log('🚨 La conexión se cerró por error temporal. Reintentando en 10s...');
          setTimeout(startGaaraBot, 10000);
        } else {
          console.log('🛑 Desconexión definitiva (loggedOut). Borrando sesión rota...');
          if (fs.existsSync(sessionName)) {
            fs.rmSync(sessionName, { recursive: true, force: true });
            console.log(`✅ Carpeta ${sessionName} eliminada. Reiniciando para generar nuevo QR.`);
          }
          startGaaraBot();
        }
      } else if (connection === 'open') {
        console.log('✅ Conexión establecida. Bot listo para comandos.');
        setInterval(sendHeartbeat, 9 * 60 * 1000);

        if (fs.existsSync('./qr.svg')) {
          fs.unlinkSync('./qr.svg');
          console.log('QR.svg eliminado al establecer conexión.');
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      try {
        const msg = m.messages[0];
        
        if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') {
          return;
        }

        console.log('[JID del Chat Actual]:', msg.key.remoteJid);

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const isCommand = body.startsWith(prefix);
        const command = isCommand ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : null;

        if (!isCommand) return;

        console.log(`[COMANDO] Recibido: ${command} de ${msg.pushName}`);

        if (command === 'menu') {
          const menuText = `
───┈  𝙍𝘦𝘪𝘯𝘰 𝙎𝘰𝘭𝘵𝘩𝘢𝘳 ┈───    
ㅤ ╰┈ _キングダムドロップ┈┈╯
── 🦢 ..
╭ーー
︰ ¡Saludos, súbdito! Soy Lewellyn D'Airelle, Canciller de Cultura del Reino.
Estoy a tu servicio para mantener el orden y la etiqueta.

⚜ COMANDOS ÚTILES: Uso unico para administración. ⚜
* ${prefix}menu: Muestra este sabroso perfil.
* ${prefix}tagall: Etiqueta a todos los miembros del grupo.

⚜ COMANDOS ÚTILES: Uso para todos. ⚜
* ${prefix}salario: Cada dos dias puedes reclamar 4 Ores.
* ${prefix}escena: Situacion con personas al azar, buena suerte!
* ${prefix}mapa: Para que puedas ver las ubicaciones de las zonas exteriores.

⚜ ECONOMIA DEL REINO (Acceso Total) ⚜
* ${prefix}money: Etiqueta al usuario para ver su total.
* ${prefix}rank: Listado de los 10 súbditos más ricos.
* ${prefix}addmoney @: Añade Ores a un súbdito.
* ${prefix}removemoney @: Retira Ores de un súbdito.

⚜ COMANDOS DE MANTENIMIENTO (Limpieza de ECONOMIA) ⚜
* ${prefix}clearores @: Pone el saldo de un súbdito a cero.
* ${prefix}deleteores <usuario>: Elimina permanentemente un registro.
* ${prefix}resetores: ¡PELIGRO! Borra toda la base de datos de Ores.

⚜ CASINO: Ludicas. ⚜
* ${prefix}roll: Escribe ademas NdX (N es el numero de dados, X el numero de caras) EJ; #roll 1d20.
* ${prefix}apostar: Añades la cantidad de ores que deseas apostar.
* ${prefix}loteria: El jugador elige un número de ores y otro numero del 1 al 10 para apostar.

Espero poder ayudarte.
╰ ーー 𖥔 ˑ ִ ˑ 𖥻 ִ ۫ ּ
── ᘞㅤֺㅤ👑𝇄 𝇃ㅤֺㅤ ::
          `.trim();

          const imagePath = './lewellyn.jpg';

          if (!fs.existsSync(imagePath)) {
            console.error('ERROR: No se encontró la imagen del canciller en la ruta:', imagePath);
            return await sock.sendMessage(msg.key.remoteJid, { text: menuText }, { quoted: msg });
          }

          await sock.sendMessage(msg.key.remoteJid, {
            image: fs.readFileSync(imagePath),
            caption: menuText
          }, { quoted: msg });
        }

        if (command === 'tagall') {
          const isGroup = msg.key.remoteJid.endsWith('@g.us');
          if (!isGroup) {
            return await sock.sendMessage(msg.key.remoteJid, { text: 'Este comando solo puede usarse en un grupo.' }, { quoted: msg });
          }

          const metadata = await sock.groupMetadata(msg.key.remoteJid);
          const participants = metadata.participants;

          let mentiosText = '✉️ ¡Atención! Estimadas damas y caballeros, les traigo una noticia de interés:\n\n';
          let mentionedJids = [];

          for (let participant of participants) {
            const jid = participant.id;
            mentiosText += `@${jid.split('@')[0]}\n`;
            mentionedJids.push(jid);
          }

          await sock.sendMessage(msg.key.remoteJid, {
            text: mentiosText,
            mentions: mentionedJids
          }, { quoted: msg });

          console.log(`[TAGALL] Mencionados ${participants.length} miembros en el grupo: ${metadata.subject}`);
        }

        if (command === 'addmoney') {
          try {
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            if (!isGroup) {
              return await sock.sendMessage(msg.key.remoteJid, { text: 'Este comando es solo para grupos del Reino Solthar.' }, { quoted: msg });
            }

            const args = body.slice(prefix.length).trim().split(/ +/);
            const targetMention = args[1];
            const amount = parseInt(args[2]);

            if (!targetMention || isNaN(amount) || amount <= 0 || !targetMention.startsWith('@')) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Uso: ${prefix}addmoney @usuario <cantidad>. La cantidad debe ser un número positivo de Ores.` }, { quoted: msg });
            }

            const targetJidRaw = targetMention.replace('@', '').split(' ')[0] + '@s.whatsapp.net';
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            const targetParticipant = groupMetadata.participants.find(p => p.id.includes(targetJidRaw.split('@')[0]));

            if (!targetParticipant) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Error: No pude encontrar a ese súbdito (@${targetJidRaw.split('@')[0]}) en el grupo.` }, { quoted: msg, mentions: [targetJidRaw] });
            }

            const targetJid = targetParticipant.id;
            const economyData = getEconomyData();
            const currentBalance = economyData[targetJid] || 0;

            economyData[targetJid] = currentBalance + amount;
            saveEconomyData(economyData);

            const mentionPlaceholder = `@${targetJid.split('@')[0]}`;
            const responseText = `✅ Tesorería Real: Se han añadido **${amount} Ores** a **${mentionPlaceholder}**. Nuevo saldo: **${economyData[targetJid]} Ores**.`;

            await sock.sendMessage(msg.key.remoteJid, { text: responseText, mentions: [targetJid] }, { quoted: msg });

          } catch (error) {
            console.error('ERROR en comando #addmoney:', error);
            await sock.sendMessage(msg.key.remoteJid, { text: `🚨 ERROR: ${error.message}` }, { quoted: msg });
          }
        }

        if (command === 'removemoney') {
          try {
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            if (!isGroup) {
              return await sock.sendMessage(msg.key.remoteJid, { text: 'Este comando es solo para grupos del Reino Solthar.' }, { quoted: msg });
            }

            const args = body.slice(prefix.length).trim().split(/ +/);
            const targetMention = args[1];
            const amount = parseInt(args[2]);

            if (!targetMention || isNaN(amount) || amount <= 0 || !targetMention.startsWith('@')) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Uso: ${prefix}removemoney @usuario <cantidad>.` }, { quoted: msg });
            }

            const targetJidRaw = targetMention.replace('@', '').split(' ')[0] + '@s.whatsapp.net';
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            const targetParticipant = groupMetadata.participants.find(p => p.id.includes(targetJidRaw.split('@')[0]));

            if (!targetParticipant) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Error: No pude encontrar a ese súbdito.` }, { quoted: msg });
            }

            const targetJid = targetParticipant.id;
            const currentBalance = getEconomyData()[targetJid] || 0;
            const economyData = getEconomyData();
            const newBalance = Math.max(0, currentBalance - amount);

            economyData[targetJid] = newBalance;
            saveEconomyData(economyData);

            const mentionPlaceholder = `@${targetJid.split('@')[0]}`;
            let responseMessage = `✅ Tesorería Real: Se han retirado **${amount} Ores** de **${mentionPlaceholder}**. Nuevo saldo: **${newBalance} Ores**.`;

            await sock.sendMessage(msg.key.remoteJid, { text: responseMessage, mentions: [targetJid] }, { quoted: msg });

          } catch (error) {
            console.error('ERROR en comando #removemoney:', error.message);
            await sock.sendMessage(msg.key.remoteJid, { text: `🚨 ERROR: ${error.message}` }, { quoted: msg });
          }
        }

        if (command === 'money' || command === 'ores') {
          const args = body.slice(prefix.length).trim().split(/ +/);
          const targetMention = args[1];

          let targetJid;
          let isSelf = false;

          if (targetMention && targetMention.startsWith('@')) {
            targetJid = targetMention.replace('@', '').split(' ')[0] + '@s.whatsapp.net';
          } else {
            targetJid = msg.key.participant || msg.key.remoteJid;
            isSelf = true;
          }

          const isGroup = msg.key.remoteJid.endsWith('@g.us');
          if (isGroup) {
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            const participant = groupMetadata.participants.find(p => p.id.includes(targetJid.split('@')[0]));
            if (participant) {
              targetJid = participant.id;
            }
          }

          const economyData = getEconomyData();
          const currentBalance = economyData[targetJid] || 0;

          let title, messageUser;
          const mentionPlaceholder = `@${targetJid.split('@')[0]}`;

          if (isSelf) {
            title = '💼 Billetera del Reino Solthar.';
            messageUser = `Estimado súbdito **${mentionPlaceholder}**, su saldo actual de Ores es:`;
          } else {
            title = '🔍 Consulta de Tesorería Real.';
            messageUser = `El súbdito **${mentionPlaceholder}** tiene un saldo actual de Ores de:`;
          }

          const responseText = `${title}\n${messageUser}\n✨ **${currentBalance} Ores** ✨`;

          await sock.sendMessage(msg.key.remoteJid, {
            text: responseText,
            mentions: [targetJid]
          }, { quoted: msg });
        }

        if (command === 'deleteores') {
          try {
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            if (!isGroup) {
              return await sock.sendMessage(msg.key.remoteJid, { text: 'Este comando es solo para grupos del Reino Solthar.' }, { quoted: msg });
            }

            const args = body.slice(prefix.length).trim().split(/ +/);
            const targetInput = args.slice(1).join(' ').trim();

            if (!targetInput) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Uso: ${prefix}deleteores <@usuario / Número / Parte del Registro>.` }, { quoted: msg });
            }

            const economyData = getEconomyData();
            let targetJidToDelete = null;
            let displayName = targetInput;

            const cleanInput = targetInput.toLowerCase().replace(/[^a-z0-9@]/g, '');

            if (targetInput.startsWith('@')) {
              const targetJidRaw = targetInput.replace('@', '').split(' ')[0] + '@s.whatsapp.net';
              const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
              const targetParticipant = groupMetadata.participants.find(p => p.id.includes(targetJidRaw.split('@')[0]));

              if (targetParticipant) {
                targetJidToDelete = targetParticipant.id;
                displayName = targetParticipant.notify || targetParticipant.pushName || targetJidToDelete.split('@')[0];
              }
            }

            if (!targetJidToDelete) {
              const foundJid = Object.keys(economyData).find(jid => jid.toLowerCase().includes(cleanInput));
              if (foundJid) {
                targetJidToDelete = foundJid;
                displayName = foundJid.split('@')[0];
              }
            }

            if (!targetJidToDelete || !economyData.hasOwnProperty(targetJidToDelete)) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ El registro asociado a **${targetInput}** no se encontró en la Tesorería.` }, { quoted: msg });
            }

            const deletedOres = economyData[targetJidToDelete];
            delete economyData[targetJidToDelete];
            saveEconomyData(economyData);

            await sock.sendMessage(msg.key.remoteJid, { text: `🗑️ **REGISTRO ELIMINADO:** La entrada **${displayName}** ha sido **borrada** de la Tesorería. Tenía ${deletedOres} Ores.` }, { quoted: msg });

          } catch (error) {
            console.error('ERROR en comando #deleteores:', error);
            await sock.sendMessage(msg.key.remoteJid, { text: `🚨 ERROR: ${error.message}` }, { quoted: msg });
          }
        }

        if (command === 'clearores') {
          try {
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            if (!isGroup) {
              return await sock.sendMessage(msg.key.remoteJid, { text: 'Este comando es solo para grupos del Reino Solthar.' }, { quoted: msg });
            }

            const args = body.slice(prefix.length).trim().split(/ +/);
            const targetMention = args[1];

            if (!targetMention || !targetMention.startsWith('@')) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Uso: ${prefix}clearores @usuario.` }, { quoted: msg });
            }

            const targetJidRaw = targetMention.replace('@', '').split(' ')[0] + '@s.whatsapp.net';
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            const targetParticipant = groupMetadata.participants.find(p => p.id.includes(targetJidRaw.split('@')[0]));

            if (!targetParticipant) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Error: No pude encontrar a ese súbdito.`, mentions: [targetJidRaw] }, { quoted: msg });
            }

            const targetJid = targetParticipant.id;
            const currentBalance = getEconomyData()[targetJid] || 0;
            const mentionPlaceholder = `@${targetJid.split('@')[0]}`;

            if (currentBalance === 0) {
              return await sock.sendMessage(msg.key.remoteJid, { text: `✅ Tesorería Real: **${mentionPlaceholder}** ya tenía **0 Ores**.`, mentions: [targetJid] }, { quoted: msg });
            }

            const economyData = getEconomyData();
            economyData[targetJid] = 0;
            saveEconomyData(economyData);

            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Tesorería Real: El saldo de **${mentionPlaceholder}** ha sido **reiniciado** a **0 Ores** (antes tenía ${currentBalance} Ores).`, mentions: [targetJid] }, { quoted: msg });

          } catch (error) {
            console.error('ERROR en comando #clearores:', error);
            await sock.sendMessage(msg.key.remoteJid, { text: `🚨 ERROR: ${error.message}` }, { quoted: msg });
          }
        }

        if (command === 'resetores') {
          try {
            saveEconomyData({});
            await sock.sendMessage(msg.key.remoteJid, { text: '🚨 ¡ADVERTENCIA REAL! 🚨\n\n**Toda la Tesorería ha sido restablecida.** El registro de Ores ha sido borrado por completo. Todos los súbditos tienen ahora **0 Ores**.' }, { quoted: msg });
          } catch (error) {
            console.error('ERROR en comando #resetores:', error);
            await sock.sendMessage(msg.key.remoteJid, { text: `🚨 ERROR: ${error.message}` }, { quoted: msg });
          }
        }

        if (command === 'roll') {
          const args = body.slice(prefix.length).trim().split(/ +/);
          const rollSyntax = args[1];

          if (!rollSyntax || !/^\d+d\d+$/i.test(rollSyntax)) {
            return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Uso: ${prefix}roll <NdX>. Ejemplo: ${prefix}roll 1d20` }, { quoted: msg });
          }

          try {
            const parts = rollSyntax.toLowerCase().split('d');
            const numDice = parseInt(parts[0]);
            const numSides = parseInt(parts[1]);

            if (numDice <= 0 || numSides <= 1) {
              return await sock.sendMessage(msg.key.remoteJid, { text: '❌ Error: El número de dados debe ser positivo y el número de caras debe ser mayor a 1.' }, { quoted: msg });
            }

            if (numDice > 50) {
              return await sock.sendMessage(msg.key.remoteJid, { text: '❌ Error: No puedo tirar más de 50 dados a la vez.' }, { quoted: msg });
            }

            let results = [];
            let total = 0;

            for (let i = 0; i < numDice; i++) {
              const roll = Math.floor(Math.random() * numSides) + 1;
              results.push(roll);
              total += roll;
            }

            const responseText = `🎲 **Tirada de Dados (${rollSyntax})**\n👤 Solicitado por: ${msg.pushName}\n🔹 Resultados: [${results.join(', ')}]\n✨ **Total:** ${total}`;

            await sock.sendMessage(msg.key.remoteJid, { text: responseText }, { quoted: msg });

          } catch (error) {
            console.error('ERROR en comando #roll:', error);
            await sock.sendMessage(msg.key.remoteJid, { text: `🚨 ERROR: ${error.message}` }, { quoted: msg });
          }
        }

        if (command === 'apostar') {
          const gamblerJid = msg.key.participant || msg.key.remoteJid;
          const args = body.slice(prefix.length).trim().split(/ +/);
          const amount = parseInt(args[1]);

          if (isNaN(amount) || amount <= 0) {
            return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Uso: ${prefix}apostar <cantidad>.` }, { quoted: msg });
          }

          const economyData = getEconomyData();
          const currentBalance = economyData[gamblerJid] || 0;

          if (currentBalance < amount) {
            return await sock.sendMessage(msg.key.remoteJid, { text: `❌ ¡Tesorería baja! No tienes **${amount} Ores** para apostar. Tu saldo: **${currentBalance} Ores**.` }, { quoted: msg });
          }

          const resultRoll = Math.floor(Math.random() * 2) + 1;
          let newBalance;
          let outcomeMessage;

          if (resultRoll === 1) {
            newBalance = currentBalance + amount;
            outcomeMessage = `👑 ¡Victoria Real! Has **ganado ${amount} Ores**.`;
          } else {
            newBalance = currentBalance - amount;
            outcomeMessage = `⚔️ Derrota. Has **perdido ${amount} Ores**.`;
          }

          economyData[gamblerJid] = newBalance;
          saveEconomyData(economyData);

          const displayName = msg.pushName || gamblerJid.split('@')[0];
          const finalMessage = `🎰 **Casino del Reino Solthar**\n👤 Jugador: ${displayName}\n🪙 Resultado (1d2): ${resultRoll}\n${outcomeMessage}\nNuevo Saldo: **${newBalance} Ores**.`;

          await sock.sendMessage(msg.key.remoteJid, { text: finalMessage }, { quoted: msg });
        }

          if (command === 'lotería' || command === 'loteria') {
          const gamblerJid = msg.key.participant || msg.key.remoteJid;
          const args = body.slice(prefix.length).trim().split(/ +/);
          const amount = parseInt(args[1]);
          const chosenNumber = parseInt(args[2]);
          const maxRange = 10;
          const winMultiplier = 5;

          if (isNaN(amount) || amount <= 0 || isNaN(chosenNumber)) {
            return await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Uso: ${prefix}lotería <cantidad> <número_1_al_10>.` }, { quoted: msg });
          }

          if (chosenNumber < 1 || chosenNumber > maxRange) {
            return await sock.sendMessage(msg.key.remoteJid, { text: `❌ ¡Error! Debes elegir un número entre **1** y **${maxRange}**.` }, { quoted: msg });
          }

          const economyData = getEconomyData();
          const currentBalance = economyData[gamblerJid] || 0;

          if (currentBalance < amount) {
            return await sock.sendMessage(msg.key.remoteJid, { text: `❌ ¡Tesorería baja! No tienes **${amount} Ores**. Tu saldo: **${currentBalance} Ores**.` }, { quoted: msg });
          }

          const winningNumber = Math.floor(Math.random() * maxRange) + 1;
          let newBalance;
          let outcomeMessage;

          if (chosenNumber === winningNumber) {
            const winAmount = amount * winMultiplier;
            newBalance = currentBalance + winAmount;
            outcomeMessage = `🎉 ¡JACKPOT! Acertaste el número **${winningNumber}**. Has **ganado ${winAmount} Ores** (${winMultiplier}x tu apuesta).`;
          } else {
            newBalance = currentBalance - amount;
            outcomeMessage = `😔 No hubo suerte. El número ganador fue **${winningNumber}**. Has **perdido ${amount} Ores**.`;
          }

          economyData[gamblerJid] = newBalance;
          saveEconomyData(economyData);

          const displayName = msg.pushName || gamblerJid.split('@')[0];
          const finalMessage = `🎯 **Lotería del Reino Solthar**\n👤 Jugador: ${displayName}\n💰 Apuesta: **${amount} Ores** | Número Elegido: **${chosenNumber}**\n${outcomeMessage}\nNuevo Saldo: **${newBalance} Ores**.`;

          await sock.sendMessage(msg.key.remoteJid, { text: finalMessage }, { quoted: msg });
        }

          if (command === 'salario') {
          const claimerJid = msg.key.participant || msg.key.remoteJid;
          const groupJid = msg.key.remoteJid;

          const cooldownData = getSalaryCooldownData();
          const lastClaimTime = cooldownData[claimerJid] || 0;
          const currentTime = Date.now();
          const timeElapsed = currentTime - lastClaimTime;

          if (timeElapsed < SALARY_COOLDOWN_MS) {
            const timeLeftMs = SALARY_COOLDOWN_MS - timeElapsed;
            const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

            let timeLeftText = '';
            if (hours > 0) timeLeftText += `${hours}h `;
            if (minutes > 0) timeLeftText += `${minutes}m `;
            timeLeftText += `${seconds}s`;

            return await sock.sendMessage(groupJid, { text: `⏳ **Espera:** ${msg.pushName}, ya reclamaste tu salario. Debes esperar **${timeLeftText}** más antes de volver a reclamar (cada 48 horas).` }, { quoted: msg });
          }

          const economyData = getEconomyData();
          const currentBalance = economyData[claimerJid] || 0;
          const newBalance = currentBalance + SALARY_AMOUNT;

          economyData[claimerJid] = newBalance;
          saveEconomyData(economyData);

          cooldownData[claimerJid] = currentTime;
          saveSalaryCooldownData(cooldownData);

          await sock.sendMessage(groupJid, {
            text: `✅ **Salario Real:** ¡Salario reclamado! En hora buena, felicidades por tu trabajo. Se han añadido **${SALARY_AMOUNT} Ores** a tu cuenta.\n\nNuevo Saldo: **${newBalance} Ores** a tu disposición.`
          }, { quoted: msg });
        }

        if (command === 'escena') {
          const groupJid = msg.key.remoteJid;
          const senderJid = msg.key.participant || msg.key.remoteJid;

          if (!groupJid.endsWith('@g.us')) {
            return await sock.sendMessage(groupJid, { text: 'Este comando solo puede usarse en los salones del Reino (grupos).' }, { quoted: msg });
          }

          try {
            const metadata = await sock.groupMetadata(groupJid);
            const participants = metadata.participants;

            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            const potentialTargets = participants
              .map(p => p.id)
              .filter(jid => jid !== botJid && jid !== senderJid);

            if (potentialTargets.length === 0) {
              return await sock.sendMessage(groupJid, { text: '¡Vaya! Parece que solo estamos tú y yo. No hay nadie más para entrar en escena.' }, { quoted: msg });
            }

            const randomIndex = Math.floor(Math.random() * potentialTargets.length);
            const targetJid = potentialTargets[randomIndex];

            const senderPlaceholder = `@${senderJid.split('@')[0]}`;
            const targetPlaceholder = `@${targetJid.split('@')[0]}`;

            const roleplayScenarios = [
              `ha encontrado a ${targetPlaceholder} en la Biblioteca Real, buscando un tomo prohibido. **Inicia una conversación sospechosa.**`,
              `ha descubierto que ${targetPlaceholder} es el único testigo de una escena vergonzosa tuya. **Debes persuadirlo para que guarde silencio.**`,
              `ha recibido una nota anónima sobre ${targetPlaceholder}, indicando que oculta un secreto familiar. **Pregúntale sobre su linaje.**`,
              `accidentalmente derramó vino caro sobre las ropas de ${targetPlaceholder} mientras brindaba en la taberna. **Pide disculpas o desafíalo.**`,
              `ha sido asignado por la corte para una misión junto a ${targetPlaceholder}, y parece que no están de acuerdo en el plan de acción. **Discute la estrategia.**`,
              `está siendo investigado por ${targetPlaceholder} por evasión de impuestos del Reino en secreto. **Confróntalo ¿es verdad?**`
            ];

            const randomScenario = roleplayScenarios[Math.floor(Math.random() * roleplayScenarios.length)];

            const responseText = `🎭 **ESCENA FORZADA** 🎭\n\n¡La Corte Real ha decretado un encuentro forzoso!\n\n${senderPlaceholder} ${randomScenario}\n\n**PARTICIPANTES:**\n👤 Jugador 1: ${senderPlaceholder} (Inicia)\n👤 Jugador 2: ${targetPlaceholder} (Responde)\n\n_¡Que empiece el drama de Solthar!_`;

            await sock.sendMessage(groupJid, {
              text: responseText,
              mentions: [targetJid, senderJid]
            }, { quoted: msg });

          } catch (error) {
            console.error('ERROR en comando #escena:', error.message);
            await sock.sendMessage(groupJid, { text: `🚨 Error de la Corte: ${error.message}` }, { quoted: msg });
          }
        }

        if (command === 'mapa') {
          const groupJid = msg.key.remoteJid;
          const mapImagePath = './SOLTHAR.PNG';

          try {
            if (!fs.existsSync(mapImagePath)) {
              console.error(`ERROR: Archivo del mapa no encontrado en: ${mapImagePath}`);
              return await sock.sendMessage(groupJid, { text: '❌ Lo siento, el mapa del Reino no pudo ser localizado por el Canciller. ¡Reporta este error!' }, { quoted: msg });
            }

            await sock.sendMessage(groupJid, {
              image: { url: mapImagePath },
              caption: '🗺️ **MAPA DEL REINO DE SOLTHAR** 🗺️\n\n_Explora nuestras tierras y forja tu leyenda, ahora puedes encontrar y ubicarte en el reino. Recuerda, las zonas nobles están dentro._'
            }, { quoted: msg });

          } catch (error) {
            console.error('ERROR en comando #mapa:', error.message);
            await sock.sendMessage(groupJid, { text: `🚨 Error al enviar el mapa: ${error.message}` }, { quoted: msg });
          }
        }

        if (command === 'rank') {
          const groupJid = msg.key.remoteJid;

          try {
            const groupMetadata = await sock.groupMetadata(groupJid);
            const participants = groupMetadata.participants;

            const getParticipantName = (jid) => {
              const participant = participants.find(p => p.id === jid);
              if (participant) {
                if (participant.notify) return participant.notify;
                if (participant.pushName) return participant.pushName;
              }
              return jid.split('@')[0];
            };

            const economyData = getEconomyData();
            const sortedEconomy = Object.entries(economyData)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10);

            let rankMessage = '🏆 **Top 10 - Ciudadanos más Ricos del Reino Solthar** 🏆\n\n';

            if (sortedEconomy.length === 0) {
              rankMessage += 'El cofre real está vacío. ¡Nadie ha reclamado Ores aún!';
            } else {
              sortedEconomy.forEach(([jid, balance], index) => {
                const name = getParticipantName(jid);
                rankMessage += `**${index + 1}.** ${name} - ${balance} Ores\n`;
              });
              rankMessage += '\n_Que vuestra riqueza prospere._';
            }

            const mentions = sortedEconomy.map(([jid]) => jid);

            await sock.sendMessage(groupJid, {
              text: rankMessage,
              mentions: mentions
            }, { quoted: msg });

          } catch (error) {
            console.error('ERROR en comando #rank:', error.message);
            await sock.sendMessage(groupJid, { text: '🚨 Error en el Canciller al calcular el ranking.' }, { quoted: msg });
          }
        }

      } catch (error) {
        console.error('❌ [ERROR CRÍTICO EN MENSAJES]:', error);
        console.error('Stack:', error.stack);
        
        try {
          await sock.sendMessage(msg.key.remoteJid, { 
            text: `🚨 Error interno del bot. Por favor reporta este error al administrador.\n\nDetalles: ${error.message}` 
          });
        } catch (notifyError) {
          console.error('No se pudo notificar el error al usuario:', notifyError);
        }
      }
    });

  } catch (e) {
    console.error('💣 ERROR FATAL INESPERADO en startGaaraBot:', e);
    console.error('Stack completo:', e.stack);
    console.log('REINICIANDO en 10 segundos...');
    setTimeout(startGaaraBot, 10000);
  }
}

// Servidor HTTP para health check
http.createServer((req, res) => {
  const qrPath = './qr.svg';

  if (fs.existsSync(qrPath)) {
    const qrContent = fs.readFileSync(qrPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <div style="font-family: sans-serif; text-align: center; padding: 20px;">
        <h1>⚠️ ¡ESCANEA ESTE CÓDIGO QR! ⚠️</h1>
        <p>Usa WhatsApp > Ajustes > Dispositivos Vinculados para conectar tu bot.</p>
        <div style="width: 300px; margin: 20px auto; border: 1px solid #ddd; padding: 10px; border-radius: 10px;">
          ${qrContent}
        </div>
        <p>Este código desaparecerá una vez que el bot esté conectado.</p>
        <p>Mantén esta página abierta por si necesitas reconectarte.</p>
      </div>
    `);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot LEWELLYN-BOT-SOLTHAR activo. ¡Ya está conectado a WhatsApp!');
  }
}).listen(port, () => {
  console.log(`\n\n✅ Servidor web iniciado en el puerto ${port}.`);
  console.log(`🔗 Accede a http://localhost:${port} para ver el QR`);
  startGaaraBot();
});
