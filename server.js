// Twilio WhatsApp Translator Bot
const express = require('express');
const twilio = require('twilio');
const { Translate } = require('@google-cloud/translate').v2;
const translate = new Translate({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    key: process.env.GOOGLE_TRANSLATE_API_KEY
});

const app = express();
app.use(express.urlencoded({ extended: true }));

// Twilio credentials (replace with your actual credentials)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);


// Your Twilio WhatsApp number
const twilioWhatsAppNumber = 'whatsapp:+14155238886';

// Language detection function
function detectLanguage(text) {
    const indonesianWords = ['dan', 'atau', 'yang', 'ini', 'itu', 'dengan', 'untuk', 'dari', 'ke', 'di', 'pada', 'adalah', 'akan', 'tidak', 'saya', 'anda', 'dia', 'mereka', 'kita'];
    const words = text.toLowerCase().split(' ');
    
    let indonesianCount = 0;
    words.forEach(word => {
        if (indonesianWords.includes(word)) {
            indonesianCount++;
        }
    });
    
    return indonesianCount > 0 ? 'id' : 'en';
}

// Translation function
async function translateText(text) {
    try {
        // Try Google's detection first
        const [detection] = await translate.detect(text);
        let detectedLang = detection.language;
        
        // If Google detected English OR Malay but text contains clear Indonesian words, override to Indonesian
        if (detectedLang === 'en' || detectedLang === 'ms') {
            const indonesianWords = ['nama', 'saya', 'anda', 'dia', 'ini', 'itu', 'yang', 'dan', 'atau', 'dengan', 'untuk', 'dari', 'ke', 'di', 'pada', 'adalah', 'akan', 'tidak'];
            const words = text.toLowerCase().split(/\s+/);
            const hasIndonesian = words.some(word => indonesianWords.includes(word));
            
            if (hasIndonesian) {
                detectedLang = 'id';
            }
        }
        
        console.log(`Detected language: ${detectedLang}`);
        
        const targetLang = detectedLang === 'id' ? 'en' : 'id';
        const [translation] = await translate.translate(text, targetLang);
        
        return translation;
        
    } catch (error) {
        console.error('Translation error:', error);
        return '❌ Translation failed. Please try again.';
    }
}

// Webhook endpoint for incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
    const incomingMessage = req.body.Body;
    const fromNumber = req.body.From;
    
    console.log(`Message from ${fromNumber}: ${incomingMessage}`);
    
    // Handle commands
    if (incomingMessage.toLowerCase().trim() === 'help') {
        const helpMessage = `🤖 *WhatsApp Translator Bot*\n\n` +
                           `Send me any text in Indonesian or English and I'll translate it!\n\n` +
                           `*Examples:*\n` +
                           `• "Hello, how are you?" → Indonesian\n` +
                           `• "Selamat pagi" → English`;
        
        await sendWhatsAppMessage(fromNumber, helpMessage);
        return res.status(200).send();
    }
    
    // Translate the message
    const translation = await translateText(incomingMessage);
    
    // Send reply
    await sendWhatsAppMessage(fromNumber, translation);
    
    res.status(200).send();
});

// Function to send WhatsApp message via Twilio
async function sendWhatsAppMessage(to, message) {
    try {
        await client.messages.create({
            body: message,
            from: twilioWhatsAppNumber,
            to: to
        });
        console.log(`✅ Sent translation to ${to}`);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Health check endpoint
app.get('/', (req, res) => {
    res.send('WhatsApp Translator Bot is running! 🤖');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Translator Bot running on port ${PORT}`);
    console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log('⚠️  Make sure to set up ngrok or deploy to get a public URL');
});

// Export for deployment
module.exports = app;