MKEYSPLOVDIV - React + Firebase

1) FIREBASE (безплатно, без карта)
   - console.firebase.google.com -> Add project
   - Build -> Authentication -> Get started -> Sign-in method -> Email/Password -> Enable
   - Authentication -> Users -> Add user: твоя имейл и парола (с тях влизаш в админ страницата)
   - Authentication -> Settings -> Authorized domains: добави mkeysplovdiv.eu и www.mkeysplovdiv.eu
   - Build -> Firestore Database -> Create database (production mode, регион eur3)
   - Firestore -> Rules -> замени всичко с това и натисни Publish:

     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /raboti/{id} {
           allow read: if true;
           allow write: if request.auth != null
             && request.auth.token.email == "n.petrov1905@gmail.com";
         }
       }
     }

   - Project settings (зъбчето) -> Your apps -> </> (Web) -> регистрирай -> копирай firebaseConfig
     и го постави в src/config.js на мястото на "ТУК"

2) КОМПЮТЪР
   - Инсталирай Node.js (LTS) от nodejs.org
   - В папката на проекта: npm install
   - За проба: npm run dev  (отваря се адрес, обикновено http://localhost:5173)
   - За сайта: npm run build  -> създава папка dist

3) КАЧВАНЕ
   - Папката dist завлачи в Netlify Drop (app.netlify.com/drop)
   - Или качи проекта в GitHub и в Netlify избери Import from Git
     (Build command: npm run build, Publish directory: dist) - тогава Netlify го билдва сам.

4) ДОБАВЯНЕ НА РАБОТИ
   - Отвори адрес-на-сайта/#/admin , влез с имейл и парола
   - Попълни формата, избери снимка, Публикувай. Нищо друго не пипаш.
