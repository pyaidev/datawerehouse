# Rahbariyat uchun taqdimot matni: Data Warehouse demo

## 1. Qisqa kirish

Ushbu demo Statistika qo'mitasi uchun Data Warehouse jarayonini web interfeys orqali tushuntirishga mo'ljallangan.

Demo test API orqali ishlaydi. Ya'ni hozircha haqiqiy vazirlik yoki idora tizimlariga ulanmagan, lekin real integratsiya qanday ishlashini ko'rsatish uchun tashqi test API dan ma'lumot olinadi va u Data Warehouse bosqichlari orqali o'tkaziladi.

Asosiy maqsad: ma'lumot manbadan kelgandan keyin u qanday qabul qilinadi, tekshiriladi, tozalanadi, saqlanadi, analitik bazaga yoziladi va foydalanuvchiga qanday taqdim etiladi - shu jarayonni ko'rinarli qilish.

## 2. Rahbariyatga aytiladigan asosiy fikr

Bu loyiha oddiy chizma emas. Web interfeysda Data Warehouse oqimi bosqichma-bosqich ishlaydi:

- test API dan ma'lumot olinadi;
- ma'lumot gateway orqali qabul qilinadi;
- streaming va landing zone bosqichlari ko'rsatiladi;
- raw data saqlanadi;
- qo'lda tuzatish va data preparation moduli orqali ma'lumot qayta ishlanadi;
- quality validation bajariladi;
- curated model hosil qilinadi;
- ClickHouse analitik bazasiga yoziladi;
- PostgreSQL metadata va audit uchun ishlatiladi;
- yakunda dashboard, API service, export va BI qatlamlariga uzatish ssenariysi ko'rsatiladi.

Demo vaqtida har bir step 3 sekundda keyingisiga o'tadi. Har step tanlanganda o'ng tomondagi sidebar ochiladi va shu bosqichda nima bo'lganini ko'rsatadi.

## 3. Nima uchun test API ishlatilgan

Hozirgi demo xavfsiz va tez ko'rsatish uchun test API asosida qilingan. Bu yondashuv rahbariyatga quyidagicha tushuntiriladi:

"Biz real davlat tizimlariga ulanmasdan turib, Data Warehouse arxitekturasining ishlash prinsipini test API orqali ko'rsatdik. Bu bizga xavfsiz demo qilish, integratsiya logikasini sinash va keyinchalik haqiqiy manbalarga ulashdan oldin jarayonni tasdiqlab olish imkonini beradi."

Test API ning roli:

- tashqi manbani simulyatsiya qiladi;
- JSON formatidagi realga yaqin ma'lumot beradi;
- FastAPI backend orqali qabul qilinadi;
- keyingi bosqichlarda xuddi real data kabi ishlov beriladi.

Muhim gap: demo yuzaki emas, lekin barcha texnologiyalar ham hozir real production cluster sifatida ulanmagan. Interfeysda bu farq statuslar bilan halol ko'rsatiladi.

## 4. Statuslar qanday tushuntiriladi

Interfeysda uch xil status bor:

### REAL EXECUTED

Bu bosqich demo vaqtida backend tomonidan real bajarilganini bildiradi.

Misol:

- FastAPI request qabul qildi;
- test API dan records oldi;
- data preparation ishladi;
- validation bajarildi;
- ClickHouse yoki PostgreSQL tomon yozish/audit ssenariysi bajarildi.

Rahbariyatga aytiladigan gap:

"REAL EXECUTED deb belgilangan bosqichlar demo vaqtida haqiqatan ishga tushadi va natija beradi."

### AVAILABLE

Bu texnologiya arxitekturada ko'zda tutilgan, lekin demo rejimida to'liq production service sifatida ulanmaganini bildiradi.

Misol:

- Airflow scheduler;
- dbt transformatsiya;
- API service;
- portal qatlami.

Rahbariyatga aytiladigan gap:

"AVAILABLE bosqichlari arxitekturada bor, keyingi bosqichda production muhitda to'liq ulanishi mumkin. Demo ularning vazifasini va oqimdagi o'rnini ko'rsatadi."

### NOT CONNECTED

Bu texnologiya yoki qatlam hozirgi demo muhitida ulanmaganini bildiradi.

Misol:

- Superset BI serveri;
- Trino query engine;
- Export service.

Rahbariyatga aytiladigan gap:

"NOT CONNECTED deb ko'rsatilgan joylarda biz hozir yolg'on real ulanish ko'rsatmayapmiz. Bu bosqichlar loyiha roadmapida bor, lekin hozirgi demo scope ichida real ulab qo'yilmagan."

## 5. Demo ssenariysi qanday ko'rsatiladi

Taqdimotda quyidagi ketma-ketlikda ko'rsatish kerak.

### 1-qadam: Source tanlash

Source qismida `eStat 4.0 / products` yoki boshqa test endpoint tanlanadi.

Tushuntirish:

"Bu yerda biz tashqi ma'lumot manbasini tanlaymiz. Productionda bu eStat, SIAT, planshet survey, Excel/CSV yoki vazirlik API bo'lishi mumkin. Demo uchun test API ishlatyapmiz."

### 2-qadam: Limit tanlash

Limit masalan `20` records qilib qo'yiladi.

Tushuntirish:

"Demo tez ishlashi uchun 20 ta record olamiz. Real tizimda bu minglab yoki millionlab records bo'lishi mumkin."

### 3-qadam: Run scenario bosish

`Run scenario` bosilganda pipeline ishga tushadi.

Tushuntirish:

"Bu tugma butun oqimni ishga tushiradi. Data API dan olinadi va Data Warehouse pipeline ichida bosqichma-bosqich yuradi."

### 4-qadam: Animatsiyani ko'rsatish

Har 3 sekundda step almashadi. Data packet connector ustida harakat qiladi.

Tushuntirish:

"Bu animatsiya data oqimini tushunarli qiladi. Qaysi bosqich ishlayotganini, qaysi bosqich bajarilganini va qaysi biri faqat arxitekturada mavjudligini ko'rish mumkin."

### 5-qadam: O'ng sidebarni ko'rsatish

Har stepda o'ng tomonda processlar chiqadi.

Tushuntirish:

"Avval modal oynalar bor edi. Rahbariyatga qulayroq bo'lishi uchun endi barcha tafsilotlar o'ng tomondagi sidebar orqali ko'rsatiladi. Bu yerda bosqich nomi, processlar, input, output, vaqt, status, kod va tavsif chiqadi."

## 6. Har bir asosiy stepni qanday tushuntirish kerak

### FastAPI

FastAPI gateway vazifasini bajaradi.

Rahbariyatga gap:

"Barcha tashqi tizimlardan keladigan requestlar avval gateway orqali qabul qilinadi. Bu yerda endpoint, limit, source va request validatsiya qilinadi."

Ko'rsatiladigan narsa:

- request qabul qilindi;
- test API endpoint chaqirildi;
- JSON payload olindi;
- records soni ko'rsatildi.

### Apache NiFi

NiFi data flow va routing vazifasini tushuntiradi.

Rahbariyatga gap:

"NiFi turli manbalardan kelgan data oqimini boshqaradi: qayerdan keldi, qayerga boradi, qanday routing qilinadi."

Demo holati:

Agar NiFi real ulanmagan bo'lsa, AVAILABLE sifatida ko'rsatiladi.

### Kafka

Kafka streaming va queue vazifasini bajaradi.

Rahbariyatga gap:

"Kafka real-time oqim uchun navbat vazifasini bajaradi. Agar bir tizim sekinlashsa ham, data yo'qolmaydi, queue orqali keyingi bosqichga uzatiladi."

Ko'rsatiladigan narsa:

- topic nomi;
- event count;
- queued yoki executed status.

### MinIO Landing

Landing zone xom data vaqtincha tushadigan joy.

Rahbariyatga gap:

"Manbadan kelgan data avval landing zone ga tushadi. Bu audit va qayta ishlash uchun kerak."

### MinIO Raw

Raw zone asl data saqlanadigan qatlam.

Rahbariyatga gap:

"Raw zone da data asl holatda saqlanadi. Keyinchalik xatolik bo'lsa, data qayerdan kelganini va dastlab qanday bo'lganini ko'rish mumkin."

### Data Preparation

Bu eng muhim qo'shilgan modul.

Rahbariyatga gap:

"Data Warehouse ga yuborishdan oldin ma'lumot qo'lda va avtomatik qayta ishlanishi kerak. Shu modulda fieldlar tozalanadi, bo'sh qiymatlar aniqlanadi, kerak bo'lsa mas'ul xodim recordni qo'lda tuzatadi."

Ko'rsatiladigan narsa:

- raw data;
- prepared data;
- qaysi field o'zgargani;
- kim yoki qaysi rule o'zgartirgani;
- audit izi.

Muhim:

"Bu joyda ma'lumot darhol DWH ga ketib qolmaydi. Oldin preparation bosqichidan o'tadi."

### Great Expectations

Data quality tekshiruvi.

Rahbariyatga gap:

"Bu bosqich data sifatini tekshiradi. Masalan, majburiy field bo'sh emasmi, qiymat tipi to'g'rimi, recordlar validatsiyadan o'tdimi."

Ko'rsatiladigan narsa:

- passed checks;
- warninglar;
- error bo'lsa qayerda to'xtagani.

### PySpark

Katta hajmdagi data processing.

Rahbariyatga gap:

"Data hajmi katta bo'lganda bitta serverda qayta ishlash yetmaydi. PySpark parallel qayta ishlash uchun ishlatiladi."

Demo holati:

Bu yerda real transformatsiya ssenariysi ko'rsatiladi yoki demo rejimida model sifatida ishlaydi.

### Curated Zone

Standartlashtirilgan data.

Rahbariyatga gap:

"Curated zone - bu tozalangan, standart formatga keltirilgan, analitika uchun tayyor data."

Ko'rsatiladigan narsa:

- input raw/prepared;
- output curated;
- o'zgargan fieldlar.

### dbt

SQL transformatsiya va data model.

Rahbariyatga gap:

"dbt business rule, KPI va fact/dimension modellarni SQL asosida boshqarish uchun kerak."

### ClickHouse

Asosiy analitik Data Warehouse.

Rahbariyatga gap:

"ClickHouse katta hajmdagi analitik so'rovlar uchun tanlangan. Dashboard va KPI shu qatlamdan tez ishlaydi."

Ko'rsatiladigan narsa:

- table nomi;
- inserted rows;
- query uchun tayyor data.

### PostgreSQL

ODS, metadata va audit.

Rahbariyatga gap:

"PostgreSQL operatsion metadata, pipeline audit, run status va servis ma'lumotlarini saqlash uchun ishlatiladi."

Muhim:

"ClickHouse dan keyin PostgreSQL ga qaytib qolayotgandek ko'rinsa, bu data oqimi orqaga qaytdi degani emas. Bu audit va metadata yozilishi bosqichi. Asosiy analitik data ClickHouse da qoladi."

### API Services

Tashqi tizimlarga data berish.

Rahbariyatga gap:

"Tayyorlangan data boshqa tizimlarga API orqali uzatilishi mumkin."

### Portal, Superset, Trino, Export

Taqdim etish qatlami.

Rahbariyatga gap:

"Foydalanuvchilar data bilan dashboard, portal, SQL query yoki export orqali ishlaydi. Hozir ayrimlari demo scope da ulanmagan, lekin arxitekturada ularning o'rni ko'rsatilgan."

## 7. Qo'lda tuzatish modulini qanday ko'rsatish kerak

Bu modulni alohida urg'u bilan ko'rsatish kerak.

Tushuntirish:

"Real hayotda data doim ideal kelmaydi. Ba'zi fieldlar noto'g'ri, bo'sh yoki formatdan tashqarida bo'lishi mumkin. Shu sababli DWH ga yuborishdan oldin preparation moduli kerak."

Demo qilish tartibi:

1. Raw data preview ko'rsatiladi.
2. Bir record tanlanadi.
3. Field qiymati qo'lda o'zgartiriladi.
4. Apply/re-run qilinadi.
5. Prepared previewda o'zgarish ko'rsatiladi.
6. Lineage orqali shu record Raw -> Prepared -> Curated yo'lini ko'rsatadi.

Rahbariyatga aytiladigan gap:

"Bu yerda har bir o'zgarish audit bilan saqlanadi. Keyinchalik kim, qachon va qaysi fieldni o'zgartirgani ko'rinishi kerak. Demo hozir shu prinsipni ko'rsatadi."

## 8. Kod oynasini qanday tushuntirish kerak

Har bir step sidebarida kod namunasi bor.

Rahbariyatga gap:

"Bu faqat rasm emas. Har bir bosqich ortida qanday texnologiya ishlashi kerakligi kod bilan ko'rsatilgan: FastAPI endpoint, Kafka publish, PySpark transform, dbt SQL, ClickHouse insert va boshqa qismlar."

Muhim:

"Kod oynasi texnik guruh uchun. Rahbariyat uchun esa asosiy qiymat - jarayon shaffofligi va nazorat qilinishi."

## 9. Xatolik ssenariysi qanday tushuntiriladi

Demo ichida failure mode tanlab ko'rsatish mumkin.

Masalan:

- validation xatosi;
- Kafka unavailable;
- API timeout.

Rahbariyatga gap:

"Agar data sifatsiz bo'lsa yoki tizimlardan biri javob bermasa, oqim ko'r-ko'rona davom etmaydi. Qayerda to'xtagani, sababi va retry imkoniyati ko'rsatiladi."

Bu nima beradi:

- xatolik tez aniqlanadi;
- data sifati nazorat qilinadi;
- mas'ul xodim qayerda muammo borligini ko'radi;
- production monitoring uchun asos bo'ladi.

## 10. Data lineage qanday tushuntiriladi

Lineage - bitta recordning hayot yo'li.

Rahbariyatga gap:

"Biz bitta recordni tanlab, u raw holatdan prepared holatga, keyin curated va analitik bazaga qanday o'tganini ko'ramiz. Bu data ishonchliligi va audit uchun juda muhim."

Ko'rsatiladigan ketma-ketlik:

Raw -> Prepared -> Validated -> Curated -> ClickHouse

Bu nimani isbotlaydi:

- data qayerdan kelgani ma'lum;
- qaysi bosqichda o'zgargani ko'rinadi;
- yakuniy hisobotdagi raqam ortidagi manba tekshiriladi.

## 11. Yakuniy hisobotni qanday tushuntirish kerak

Scenario tugagach yakuniy natija ko'rsatiladi.

Rahbariyatga gap:

"Pipeline tugagandan keyin umumiy hisobot chiqadi: nechta record kelgan, nechta record validatsiyadan o'tgan, qancha vaqt ketgan, warning bormi, data qayerga yozildi va qaysi table tayyor bo'ldi."

Ko'rsatiladigan metrikalar:

- records soni;
- quality score;
- umumiy bajarilish vaqti;
- warninglar;
- storage path;
- database table;
- statuslar.

## 12. Rahbariyat uchun 2 daqiqalik nutq

Quyidagi matnni taqdimot boshida aytish mumkin:

"Biz bu demoda Statistika qo'mitasi Data Warehouse arxitekturasining ishlash jarayonini web interfeys orqali ko'rsatamiz. Ma'lumot test API dan olinadi, chunki hozir real davlat tizimlariga ulanmasdan xavfsiz demo qilishimiz kerak. Lekin jarayon real Data Warehouse prinsipiga asoslangan: data gateway orqali olinadi, oqimga yuboriladi, raw zone da saqlanadi, preparation modulida tozalanadi yoki qo'lda tuzatiladi, quality validationdan o'tadi, curated modelga aylanadi va ClickHouse analitik bazasiga yoziladi. Har bir bosqichda o'ng tomonda nima bajarilgani, input va output, ishlagan vaqt, status va kod ko'rsatiladi. Biz real bajarilgan bosqichlarni REAL EXECUTED deb, arxitekturada mavjud lekin hali ulanmagan qismlarni AVAILABLE yoki NOT CONNECTED deb halol ajratib ko'rsatdik. Bu demo keyingi production integratsiya uchun konsept va texnik asos bo'lib xizmat qiladi."

## 13. Rahbariyat savol bersa, qisqa javoblar

### Bu haqiqiy data bilan ishlaydimi?

Hozir demo test API bilan ishlaydi. Arxitektura haqiqiy API, Excel/CSV, SIAT, eStat va boshqa manbalarga ulanishga tayyor qilib ko'rsatilgan.

### Nima uchun hammasi REAL EXECUTED emas?

Chunki demo muhitida barcha production servislarni ulash shart emas. Biz real bajarilgan va hozircha ulanmagan qismlarni alohida status bilan ko'rsatdik. Bu halol yondashuv.

### Data xato bo'lsa nima bo'ladi?

Validation bosqichida xato aniqlanadi. Oqim to'xtashi, warning berishi yoki retry qilishi mumkin. Data preparation modulida qo'lda tuzatish ham bor.

### Nega ClickHouse kerak?

ClickHouse katta hajmdagi analitik so'rovlar va dashboardlar uchun tez ishlaydi. KPI va hisobotlar uchun mos.

### Nega PostgreSQL ham bor?

PostgreSQL metadata, audit, run history va servis ma'lumotlari uchun kerak. ClickHouse analitika uchun, PostgreSQL boshqaruv va operatsion ma'lumotlar uchun ishlatiladi.

### Bu productionga tayyormi?

Bu demo va konseptual MVP. Production uchun real manbalar, xavfsizlik, SSO, monitoring, backup, CI/CD, role-based access va to'liq servis integratsiyalari yakunlanishi kerak.

## 14. Taqdimotda alohida urg'u beriladigan qiymatlar

- Data oqimi ko'rinarli bo'ladi.
- Har bir stepda nima bo'layotgani tushunarli bo'ladi.
- Data sifati nazorat qilinadi.
- Xatolik qayerda chiqqani ko'rinadi.
- Qo'lda tuzatish DWH ga ketishdan oldin bajariladi.
- Har bir record bo'yicha lineage ko'rinadi.
- Real bajarilgan va ulanmagan qismlar halol ajratiladi.
- Keyingi production integratsiya uchun asos tayyorlanadi.

## 15. Demo yakunida aytiladigan xulosa

"Bugungi demo Data Warehouse jarayonini rahbariyat va texnik guruh uchun bir xil darajada tushunarli qilishga qaratilgan. Biz test API orqali realga yaqin ma'lumot oqimini ko'rsatdik, har bir bosqichni alohida ochdik, data preparation va quality nazoratini qo'shdik, ClickHouse/PostgreSQL qatlamlarini ajratdik va yakunda foydalanuvchiga dashboard/API/export orqali taqdim etish ssenariysini ko'rsatdik. Keyingi bosqich - haqiqiy manbalarga ulanish, production servislarni to'liq integratsiya qilish va xavfsizlik hamda monitoringni yakunlash."

## 16. Data Preparation statuslari va versionlash

Data Preparation bosqichi Data Warehouse ga yuborishdan oldingi nazorat nuqtasi sifatida tushuntiriladi. Bu yerda data darhol ClickHouse yoki DWH ga ketmaydi. Oldin alohida prepared version yaratiladi.

Statuslar:

- `RAW_RECEIVED` - raw zone dan asl data o'qildi. Raw data o'zgartirilmaydi.
- `PROFILED` - columnlar, type va umumiy rows profili tekshirildi.
- `NORMALIZED` - string trim, bo'sh qiymatlarni NULL qilish kabi tozalash bajarildi.
- `MANUAL_CORRECTION` - operator kiritgan qo'lda tuzatishlar qo'llandi yoki rad etildi.
- `PREPARED_VERSION_SAVED` - yangi prepared version saqlandi, masalan `prepared.json`.
- `QUALITY_GATE` - shu prepared version quality validation ga yuboriladi.
- `READY_FOR_DWH` - validationdan keyin data Curated Zone va ClickHouse DWH ga ketishga tayyor.

Rahbariyatga aytiladigan asosiy gap:

"Data Preparation - bu DWH oldidagi nazorat eshigi. Raw data buzilmaydi, har bir tuzatish yangi prepared version sifatida saqlanadi. Faqat shu version quality checkdan o'tgandan keyin Data Warehouse ga yuboriladi. Shuning uchun keyinchalik qaysi ma'lumot qachon, qanday tuzatilgani va qaysi version DWH ga ketgani ko'rinadi."

## 17. Imputatsiya va edit jarayoni

Data Preparation ichida `IMPUTATION_EDIT` bosqichi qo'shildi. Bu bosqichning vazifasi - DWH ga sifatsiz yoki bo'sh qiymat yubormaslik.

Jarayon:

- blank yoki `NULL` qiymatlar aniqlanadi;
- column bo'yicha default yoki hisoblangan qiymat tanlanadi;
- qiymat prepared version ichida to'ldiriladi;
- operator kerak bo'lsa shu recordni qo'lda edit qiladi;
- har bir record uchun `raw:v0`, `prep:v1`, `qa:v2`, `dwh:v3` ko'rinishidagi version ID ko'rsatiladi;
- faqat prepared/quality version tayyor bo'lgandan keyin data DWH ga ketadi.

Rahbariyatga aytiladigan gap:

"Bu bosqichda ma'lumot avtomatik to'ldiriladi yoki operator tomonidan edit qilinadi. Raw data o'zgarmaydi. Har bir record o'z version ID siga ega bo'ladi, shu sababli qaysi record qaysi version bilan DWH ga ketgani kuzatiladi."
