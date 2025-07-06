const TELEGRAM_BOT_TOKEN = "7646074047:AAE449Ta8XQJGzhs7VasCKmyHPYvzatM2Lk";

export async function sendTelegramAlert(message, chatId = "-1002770234378") {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "Markdown"
            })
        });

        if (!res.ok) {
            throw new Error(`Telegram API error: ${res.status}`);
        }

        const data = await res.json();
        return data;
    } catch (error) {
        console.error("❌ Lỗi khi gửi tin nhắn Telegram:", error);
    }
}
