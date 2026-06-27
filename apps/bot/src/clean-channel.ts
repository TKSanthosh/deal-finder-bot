import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables — NEVER hardcode secrets!
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat_id = process.env.TELEGRAM_CHAT_ID;

if (!token || !chat_id) {
  console.error('❌ TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in environment variables.');
  process.exit(1);
}

async function main() {
  console.log('🧹 Cleaning up Telegram channel: deleting all test messages...');

  for (let msgId = 1; msgId <= 100; msgId++) {
    try {
      await axios.post(`https://api.telegram.org/bot${token}/deleteMessage`, {
        chat_id: chat_id,
        message_id: msgId
      });
      console.log(`Deleted message ID: ${msgId}`);
    } catch (err: any) {
      // Message might not exist or already be deleted, which is fine
    }
  }
  console.log('✨ Channel cleaned successfully!');
}

main().catch(console.error);
