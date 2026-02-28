from backend.app import create_app
from backend.models import db, User, ChatbotParticipant, Chatbot

app = create_app()
with app.app_context():
    bots = Chatbot.query.all()
    print('Existing chatbots:', [b.id for b in bots])
    if not bots:
        print('No chatbots to assign')
    if len(bots) >= 1:
        bot1 = bots[0]
        if not User.query.filter_by(username='user1').first():
            u = User(username='user1', email='user1@example.com', name='User One', role='user')
            u.set_password('password')
            db.session.add(u)
            db.session.commit()
            p = ChatbotParticipant(chatbot_id=bot1.id, user_id=u.id)
            db.session.add(p)
            db.session.commit()
            print('Created user1 and assigned to', bot1.id)
        else:
            print('user1 exists')
    if len(bots) >= 3:
        bot3 = bots[2]
        if not User.query.filter_by(username='user2').first():
            u2 = User(username='user2', email='user2@example.com', name='User Two', role='user')
            u2.set_password('password')
            db.session.add(u2)
            db.session.commit()
            p2 = ChatbotParticipant(chatbot_id=bot3.id, user_id=u2.id)
            db.session.add(p2)
            db.session.commit()
            print('Created user2 and assigned to', bot3.id)
        else:
            print('user2 exists')
