# Ronit AI Voice Coach

A production-ready AI voice coaching platform built with Flask, featuring ElevenLabs voice integration, Gemini AI for personalized care plan generation, Mailjet email delivery, and Razorpay payment processing.

## 🚀 Features

- **Voice Coaching**: Real-time voice conversations with AI coach using ElevenLabs Conversational AI
- **Personalized Care Plans**: AI-generated care plans using Google Gemini
- **Email Delivery**: Automated email notifications via Mailjet (with SMTP fallback)
- **Payment Integration**: Secure payment processing with Razorpay
- **Production Ready**: Comprehensive error handling, logging, security headers, and rate limiting

## 📋 Prerequisites

- Python 3.10 or higher
- ElevenLabs API account with Conversational AI agent
- Google Gemini API key
- Mailjet account (or SMTP server for email)
- Razorpay account (optional, for payments)

## 🛠️ Installation

1. **Clone the repository** (or navigate to the project directory)

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**:
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source venv/bin/activate
     ```

4. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual API keys and configuration.

## ⚙️ Configuration

### Required Environment Variables

- `ELEVEN_API_KEY`: Your ElevenLabs API key
- `AGENT_ID`: Your ElevenLabs Conversational AI agent ID
- `GEMINI_API_KEY`: Your Google Gemini API key
- `MAILJET_API_KEY`: Your Mailjet API key
- `MAILJET_API_SECRET`: Your Mailjet API secret
- `FROM_EMAIL`: Sender email address
- `FROM_NAME`: Sender display name

### Optional Environment Variables

- `PORT`: Server port (default: 5000)
- `ENVIRONMENT`: Environment mode - `production` or `development` (default: production)
- `DEBUG`: Enable debug mode (default: false)
- `LOG_LEVEL`: Logging level - `INFO` or `DEBUG` (default: INFO)
- `SECRET_KEY`: Flask secret key for sessions
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: SMTP fallback configuration
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: Razorpay payment configuration

See `.env.example` for a complete list of configuration options.

## 🚀 Running the Application

### Development Mode

```bash
python app.py
```

The application will start on `http://localhost:5000`

### Production Mode

For production, use a WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

Or with environment variables:

```bash
gunicorn -w 4 -b 0.0.0.0:$PORT app:app
```

## 📁 Project Structure

```
.
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── README.md             # This file
├── public/               # Frontend static files
│   ├── index.html
│   ├── script.js
│   └── styles.css
└── data/                 # Data storage directory
    ├── blueprint_*.json  # Saved care plans
    └── session_*.txt     # Session transcripts
```

## 🔌 API Endpoints

### Public Endpoints

- `GET /` - Main application page
- `GET /healthz` - Health check endpoint
- `GET /config` - Public configuration (no sensitive data)
- `GET /conversation-token` - Get ElevenLabs conversation token (rate limited: 5/min)
- `POST /upload-session` - Upload session transcript and generate care plan (rate limited: 10/hour)
- `GET /blueprint/<blueprint_id>` - View care plan blueprint
- `POST /api/payments/razorpay/order` - Create Razorpay payment order (rate limited: 20/hour)
- `GET /email/test?to=email@example.com` - Test email configuration (rate limited: 5/hour)

## 🔒 Security Features

- **Rate Limiting**: All endpoints are rate-limited to prevent abuse
- **Input Validation**: Email and transcript validation with sanitization
- **Security Headers**: XSS protection, frame options, content type options
- **CORS Configuration**: Configurable CORS headers
- **Error Handling**: Comprehensive error handling without exposing sensitive information
- **Path Traversal Protection**: Blueprint ID validation prevents directory traversal

## 📊 Logging

The application uses Python's standard logging module. Logs include:
- Request/response information
- Error details (without sensitive data)
- API call status
- Email delivery status

Set `LOG_LEVEL=DEBUG` for detailed debugging information.

## 🧪 Testing

### Test Email Configuration

```bash
curl "http://localhost:5000/email/test?to=your@email.com"
```

### Health Check

```bash
curl http://localhost:5000/healthz
```

## 🐛 Troubleshooting

### Agent Not Responding

1. Verify `ELEVEN_API_KEY` and `AGENT_ID` are correct
2. Check ElevenLabs dashboard - ensure agent is active and has "Auto-respond" enabled
3. Check browser console for WebRTC errors
4. Verify microphone permissions

### Email Not Sending

1. Verify Mailjet credentials are correct
2. Check Mailjet dashboard for delivery status
3. Test with `/email/test` endpoint
4. Check application logs for error messages
5. Ensure SMTP fallback is configured if Mailjet fails

### Care Plan Not Generating

1. Verify `GEMINI_API_KEY` is correct
2. Check Gemini API quota/limits
3. Review application logs for API errors
4. Ensure transcript is not empty

## 📝 Environment Setup Checklist

- [ ] Python 3.10+ installed
- [ ] Virtual environment created and activated
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file created from `.env.example`
- [ ] ElevenLabs API key and Agent ID configured
- [ ] Gemini API key configured
- [ ] Mailjet API credentials configured
- [ ] Email sender address verified
- [ ] (Optional) Razorpay credentials configured
- [ ] (Optional) SMTP fallback configured
- [ ] Application tested with `/healthz` endpoint

## 🚢 Deployment

### Recommended Production Setup

1. **Use a production WSGI server**:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

2. **Set environment variables**:
   - `ENVIRONMENT=production`
   - `DEBUG=false`
   - `LOG_LEVEL=INFO`

3. **Use a reverse proxy** (nginx, Apache) for SSL termination

4. **Set up process management** (systemd, supervisor, PM2)

5. **Configure monitoring** and alerting

6. **Set up log rotation** for application logs

### Docker Deployment (Optional)

Create a `Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

## 📄 License

[Add your license here]

## 🤝 Support

For issues and questions, please check the troubleshooting section or open an issue in the repository.

## 🔄 Changelog

### Version 1.0.0
- Initial production-ready release
- Comprehensive error handling and logging
- Security improvements
- Input validation and sanitization
- Production configuration options
