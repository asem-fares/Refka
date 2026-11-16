// Strings (English + Egyptian Arabic), error text and small formatters. No DOM here.
export const T = {
  en: {
    back: 'Back', retry: 'Try again', loading: 'Loading…', cancel: 'Cancel', save: 'Save', close: 'Close', copy: 'Copy', copied: 'Copied', copyFail: 'Could not copy. Press and hold the text to copy it.',
    next: 'Next', you: 'You', langName: 'English', otherLang: 'العربية', powered: 'Powered by Refka',
    tabHome: 'Home', tabRefka: 'Refka', tabMe: 'Me', refka: 'Refka', bTT: 'Train together?',
    g_muscle: 'Build muscle', g_fat: 'Lose fat', g_fit: 'Get fit', g_strength: 'Strength', g_crossfit: 'CrossFit', g_fight: 'Fighting sports',
    s_morning: 'Morning', s_afternoon: 'Afternoon', s_evening: 'Evening', s_late: 'Late night',
    x_new: 'Under 6 months', x_mid: '6 to 24 months', x_adv: '2 to 5 years', x_pro: '5+ years',
    d0: 'Sun', d1: 'Mon', d2: 'Tue', d3: 'Wed', d4: 'Thu', d5: 'Fri', d6: 'Sat', today: 'Today', tomorrow: 'Tomorrow',
    rt_train: 'Train together', rt_spot: 'Spot me',
    // entry
    loadFailH: 'Could not connect', loadFailP: 'Check your internet and try again.',
    noGymH: 'Ask your gym for its link', noGymP: 'This app opens from your gym\'s own link or QR code. Ask the front desk to send it to you, then open it on this phone.',
    badGymH: 'We could not find this gym', badGymP: 'The link may be mistyped, or the gym is not live yet. Ask your gym for its link.',
    joinH: 'Join {g} on your phone', joinP: 'Your membership, your check-in QR and the people you train with, in the gym\'s own app.',
    joinSafe: 'Your number is never shown to other members.',
    phoneL: 'Mobile number', pinL: 'PIN (6 digits)', pinHint: 'First time here? Choose 6 digits you will remember.', pin2L: 'Type the PIN again',
    go: 'Continue', e_phone: 'Enter your mobile number, for example 01012345678.', e_pin: 'The PIN is 6 digits.', e_pin2: 'The two PINs are not the same.',
    noAccH: 'No account with this number and PIN', noAccP: 'If you already have an account, check the PIN and try again. First time here? Create your account with this number.',
    createAcc: 'Create my account', newAccH: 'Create your account', newAccP: 'Type your PIN once more so we know it is right.', changeNum: 'Use another number',
    aboutH: 'About you', aboutP: 'So {g} knows who you are. Other members see your name, never your number.',
    nameL: 'Your name', sex: 'You are', man: 'A man', woman: 'A woman', by: 'Birth year',
    e_about: 'Add your name, choose a man or a woman, and add your birth year.', e_year: 'Enter a birth year like 1998.',
    joinGo: 'Join {g}', notYou: 'Not your number? Sign out',
    matchedH: 'Welcome, {n}', matchedTag: 'On the gym\'s list', matchedP: '{g} already has your number on its members list, so your membership is ready.',
    guestH: 'One step left, {n}', guestTag: 'Waiting for the gym', guestP: 'Your number is not on {g}\'s list yet, so the gym has to approve you first. Tell the front desk you joined. Until then the check-in QR and the community stay closed.',
    openApp: 'Open my app',
    // home
    hi: 'Hi {n}', st_active: 'Active', st_soon: 'Ends soon', st_ended: 'Ended', st_guest: 'Waiting for the gym', st_none: 'No package yet',
    memH: 'Membership', endsOn: 'Ends {d}', endedOn: 'Ended {d}', noEnd: 'No end date', daysLeft: 'days left', lastDay: 'Last day is today',
    guestCard: '{g} has not approved you yet. Tell the front desk you joined.',
    qrH: 'Your check-in QR', qrP: 'Show it at the desk. It changes every minute, so a screenshot will not work.',
    qrGuest: 'Your QR opens once {g} approves you.', qrExpired: 'Your membership has ended, so the QR is off. Renew to get it back.',
    qrNone: 'The QR is not available right now.', qrFail: 'Could not refresh the QR. Check your internet.', qrNew: 'Get a new code',
    hereNow: 'At the gym now', weekIns: 'Your check-ins this week',
    renew: 'Renew', payFirst: 'Pay for a package', rnWait: 'Waiting for {g} to confirm', rnWaitP: 'The desk checks your payment and confirms. Your new end date shows here after that.',
    aboutGym: 'About {g}',
    // renew
    rnH: 'Pay {g}', rn1: 'Pick a package', rn2: 'How do you want to pay?', rn3: 'Send the proof',
    month1: '1 month', monthN: '{n} months', offerUntil: 'Offer until {d}',
    payInsta: 'InstaPay', payWallet: 'Wallet', payDesk: 'Cash at the desk',
    instaTo: 'Send {a} by InstaPay to', walletTo: 'Send {a} to this wallet number', cashP: 'Pay {a} at the front desk. They confirm it and your membership updates here.',
    ref: 'Transaction reference', refH: 'From the InstaPay or wallet receipt, so the desk can match it.', e_ref: 'Add the reference number from the receipt, at least 4 characters.',
    e_pick: 'Pick a package and how you will pay.', sendProof: 'Send to {g}', cashGo: 'I will pay at the desk',
    noPkgs: '{g} has not added packages to the app yet. Ask the front desk.', noPay: '{g} has not set up payment in the app yet. Pay at the front desk.',
    rnSent: 'Sent. {g} will confirm it.', rnGuest: 'You can pay now. The desk approves you and confirms the payment together.',
    // gym page
    pkgs: 'Packages', howPay: 'How to pay', payInstaL: 'InstaPay address', payWalletL: 'Wallet number', payCashL: 'Cash is accepted at the front desk.',
    // refka tab
    rkFor: 'For you', rkFeed: 'Feed', rkReq: 'Requests', rkMine: 'My Refkas',
    search: 'Search by name', sugP: 'People who come when you do are first. Nobody can message you before you say yes.',
    noSug: 'Nobody to suggest right now. Add your training times in Me so we can find people who come when you do.', noFound: 'No one by that name.',
    ovl: 'You both come: {d}', sentAlready: 'Request sent', answer: 'Answer the request', chat: 'Chat',
    gateGuest: 'This opens once {g} approves you. Tell the front desk you joined.', gateExpired: 'Your membership has ended. Renew to see people and to be seen.',
    reqH: 'Train together with {n}?', type: 'Type', whenDay: 'Which day', whenR: 'What time', noFree: 'No free text before a yes, so a request can never carry a phone number or a bad word.',
    sendR: 'Send request', reqSent: 'Sent. {n} sees it now.', e_slot: 'Choose a day and a time.',
    inH2: 'Waiting for you', outH: 'You sent', accept: 'Accept', notNowR: 'Not now', waiting: 'Waiting for {n}', accepted: '{n} said yes', declinedOut: 'Not this time', cancelledOut: 'Cancelled',
    cancelReq: 'Cancel request', noReq: 'No requests waiting. Send one from For you.', noOut: 'You have not sent any requests yet.',
    acceptedT: 'You and {n} are a Refka now.', declinedT: 'Request declined.', cancelledT: 'Request cancelled.',
    mineEmpty: 'No Refka yet. Send "Train together?" to someone who comes when you do.', noMsgs: 'No messages yet. Say hi.', youPfx: 'You: ', since: 'Since {d}',
    // person
    goal: 'Goal', level: 'Training for', when: 'Comes', block: 'Block', report: 'Report',
    blockH: 'Block {n}?', blockP: 'You will not see each other anywhere in the app. Any Refka or request between you ends. They are not told.', blocked: 'Blocked. You will not see each other anywhere.',
    reportH: 'Report {n}', reportPostH: 'Report this post', reportP: 'It goes to {g} only. The person is not told.', reportDo: 'Send report', reported: 'Report sent to {g}. They are not told.',
    rs_harassment: 'Harassment', rs_offensive: 'Rude or offensive', rs_spam: 'Fake or spam', rs_other: 'Something else', e_reason: 'Choose a reason.',
    // feed
    feedP: 'The whole gym, one family. Everyone who can see your profile sees your posts. Chats stay private.',
    postPh: 'Share something with the gym', addPhoto: 'Add a photo', chPhoto: 'Change photo', rmPhoto: 'Remove photo', postBtn: 'Post', posted: 'Posted to the feed.', postSent: 'Sent. It shows once {g} approves it.',
    feedEmpty: 'No posts yet. Be the first.', respect: 'Respect', respected: 'Respect sent', respectN: '{n} Respect, only you see this', pendingP: 'Waiting for {g} to approve',
    delPost: 'Delete', delPostH: 'Delete this post?', delPostP: 'It disappears from the feed for everyone.', deleted: 'Post deleted.', more: 'Show more', postOpts: 'Post options',
    e_post: 'Write something or add a photo.', e_img: 'Could not read this photo. Try another one.', photoAlt: 'Photo posted by {n}',
    // chat
    typeMsg: 'Message', send: 'Send', chatEmpty: 'You are a Refka now. Say hi and agree on a time.', chatOpts: 'Chat options',
    endRefka: 'End this Refka', endH: 'End your Refka with {n}?', endP: 'The chat closes for both of you. You can send a new request later.', endDo: 'End Refka', ended: 'Refka ended.',
    chatEnded: 'This Refka has ended, so the chat is closed.', sendFail: 'Not sent', resend: 'Send again',
    // me
    editProfile: 'Edit profile', privacy: 'Privacy', lang: 'Language', signOut: 'Sign out', signOutH: 'Sign out of this phone?', signOutP: 'You will need your number and PIN to come back.',
    bioL: 'A line about you (optional)', bioPh: 'For example: evenings, working on my squat', goalL: 'Your goal', levelL: 'How long you have trained', timesL: 'When you come',
    timesH: 'Pick every time that fits. We use it to suggest people.', savedT: 'Saved.', e_name: 'Add your name.',
    pvSee: 'Who sees my profile and posts',
    pvAll: 'Everyone at {g}', pvAllP: 'Members of {g} can see your profile and posts and send you "Train together?". A man and a woman see each other only when both chose this option.',
    pvAllPNoCross: 'At {g} men and women do not see each other in the app, so only your own gender sees you.',
    pvGender_m: 'Men only', pvGender_f: 'Women only',
    pvGenderP_m: 'Only men at {g} see your profile and posts or send you requests. Women do not see you.', pvGenderP_f: 'Only women at {g} see your profile and posts or send you requests. Men do not see you.',
    pvNone: 'Nobody', pvNoneP: 'You do not show up in For you or in the feed, and nobody can send you a request. Refkas you already have can still chat with you.',
    pvReq: 'Whatever you choose, nobody can message you before you accept their request.', pvMinor: 'Because you are under 18, only members under 18 see you, and you only see them.',
    e_joinDup: 'This number is already linked to another account at this gym. Ask the front desk.', e_joinFull: 'The gym cannot take new sign-ups from the app right now. Ask the front desk.',
    limitPost: 'You reached today\'s limit of posts. Try again tomorrow.', limitChat: 'You are sending too fast. Wait a moment.', limitReport: 'You sent many reports today. If it is urgent, talk to the front desk.',
    st_hidden: 'Hidden by the gym', joinAgainP: 'You already have a Refka account as {n}. Join {g} with the same profile.', viewProfile: 'View profile',
    avatarL: 'Profile photo', yourNumber: 'Your number', hiddenChat: 'You two can no longer see each other, so the chat is closed.', memEnded: 'Your membership has ended.',
    signedOutT: 'Your session ended. Sign in again.', unread: 'new', e_nameShort: 'Your name needs at least 2 letters.', codeIn: 'New code in {s}s',
    // time
    justNow: 'Just now', agoM: '{n} min ago', agoH: '{n}h ago', agoD: '{n}d ago',
  },
  ar: {
    back: 'رجوع', retry: 'جرّب تاني', loading: 'بنحمّل…', cancel: 'إلغاء', save: 'احفظ', close: 'اقفل', copy: 'انسخ', copied: 'اتنسخ', copyFail: 'معرفناش ننسخ. دوس على الكلام كتير عشان تنسخه.',
    next: 'التالي', you: 'إنت', langName: 'العربية', otherLang: 'English', powered: 'بيشتغل بـ Refka',
    tabHome: 'الرئيسية', tabRefka: 'رفقة', tabMe: 'أنا', refka: 'رفقة', bTT: 'نتمرن سوا؟',
    g_muscle: 'تضخيم عضل', g_fat: 'تخسيس', g_fit: 'لياقة', g_strength: 'قوة', g_crossfit: 'كروس فت', g_fight: 'رياضات قتالية',
    s_morning: 'الصبح', s_afternoon: 'الضهر', s_evening: 'بالليل', s_late: 'آخر الليل',
    x_new: 'أقل من 6 شهور', x_mid: 'من 6 شهور لسنتين', x_adv: 'من سنتين لـ 5', x_pro: 'أكتر من 5 سنين',
    d0: 'الحد', d1: 'الاتنين', d2: 'التلات', d3: 'الأربع', d4: 'الخميس', d5: 'الجمعة', d6: 'السبت', today: 'النهارده', tomorrow: 'بكرة',
    rt_train: 'نتمرن سوا', rt_spot: 'تسندني',
    loadFailH: 'مش عارفين نوصل', loadFailP: 'راجع النت وجرّب تاني.',
    noGymH: 'اطلب اللينك من الجيم بتاعك', noGymP: 'التطبيق ده بيفتح من لينك أو كود QR خاص بالجيم بتاعك. اطلبه من الديسك وافتحه على الموبايل ده.',
    badGymH: 'مش لاقيين الجيم ده', badGymP: 'ممكن اللينك مكتوب غلط، أو الجيم لسه ما اشتغلش. اطلب اللينك من الجيم بتاعك.',
    joinH: 'ادخل {g} من موبايلك', joinP: 'اشتراكك، وكود الدخول، والناس اللي بتتمرن معاهم، في تطبيق الجيم نفسه.',
    joinSafe: 'رقمك عمره ما بيظهر لأعضاء تانيين.',
    phoneL: 'رقم الموبايل', pinL: 'الرقم السري (6 أرقام)', pinHint: 'أول مرة؟ اختار 6 أرقام تفتكرهم.', pin2L: 'اكتب الرقم السري تاني',
    go: 'كمّل', e_phone: 'اكتب رقم موبايلك، مثلًا 01012345678.', e_pin: 'الرقم السري 6 أرقام.', e_pin2: 'الرقمين السريين مش زي بعض.',
    noAccH: 'مفيش حساب بالرقم ده والرقم السري ده', noAccP: 'لو عندك حساب، راجع الرقم السري وجرّب تاني. أول مرة؟ اعمل حسابك بالرقم ده.',
    createAcc: 'اعمل حسابي', newAccH: 'اعمل حسابك', newAccP: 'اكتب الرقم السري مرة كمان عشان نتأكد إنه صح.', changeNum: 'استخدم رقم تاني',
    aboutH: 'عنك', aboutP: 'عشان {g} تعرفك. الأعضاء بيشوفوا اسمك بس، ورقمك لأ.',
    nameL: 'اسمك', sex: 'إنت', man: 'راجل', woman: 'ست', by: 'سنة الميلاد',
    e_about: 'اكتب اسمك، واختار راجل ولا ست، واكتب سنة ميلادك.', e_year: 'اكتب سنة الميلاد زي 1998.',
    joinGo: 'ادخل {g}', notYou: 'مش رقمك؟ اخرج',
    matchedH: 'أهلًا يا {n}', matchedTag: 'في قايمة الجيم', matchedP: '{g} عندها رقمك في قايمة الأعضاء، واشتراكك جاهز.',
    guestH: 'فاضل خطوة يا {n}', guestTag: 'مستني موافقة الجيم', guestP: 'رقمك لسه مش في قايمة {g}، فالجيم لازم توافق عليك الأول. قول للديسك إنك سجّلت. لحد ما يوافقوا، كود الدخول والمجتمع مقفولين.',
    openApp: 'افتح تطبيقي',
    hi: 'أهلًا يا {n}', st_active: 'شغّال', st_soon: 'قرّب يخلص', st_ended: 'خلص', st_guest: 'مستني موافقة الجيم', st_none: 'لسه مفيش باقة',
    memH: 'الاشتراك', endsOn: 'بيخلص {d}', endedOn: 'خلص {d}', noEnd: 'من غير تاريخ انتهاء', daysLeft: 'يوم فاضل', lastDay: 'آخر يوم النهارده',
    guestCard: '{g} لسه ما وافقتش عليك. قول للديسك إنك سجّلت.',
    qrH: 'كود الدخول بتاعك', qrP: 'ورّيه للديسك. بيتغير كل دقيقة، فالسكرين شوت مش هتنفع.',
    qrGuest: 'كود الدخول هيفتح لما {g} توافق عليك.', qrExpired: 'اشتراكك خلص، فكود الدخول مقفول. جدّد عشان يرجع.',
    qrNone: 'كود الدخول مش متاح دلوقتي.', qrFail: 'معرفناش نجدد الكود. راجع النت.', qrNew: 'هات كود جديد',
    hereNow: 'في الجيم دلوقتي', weekIns: 'دخلت كام مرة الأسبوع ده',
    renew: 'جدّد', payFirst: 'ادفع باقة', rnWait: 'مستنيين {g} تأكد', rnWaitP: 'الديسك بيراجع الدفع ويأكد. تاريخ الانتهاء الجديد هيظهر هنا بعدها.',
    aboutGym: 'عن {g}',
    rnH: 'ادفع لـ {g}', rn1: 'اختار باقة', rn2: 'هتدفع إزاي؟', rn3: 'ابعت الإثبات',
    month1: 'شهر', monthN: '{n} شهور', offerUntil: 'العرض لحد {d}',
    payInsta: 'إنستاباي', payWallet: 'محفظة', payDesk: 'كاش في الديسك',
    instaTo: 'حوّل {a} بإنستاباي على', walletTo: 'حوّل {a} على رقم المحفظة ده', cashP: 'ادفع {a} في الديسك. هم يأكدوا واشتراكك يتحدّث هنا.',
    ref: 'رقم العملية', refH: 'من إيصال إنستاباي أو المحفظة، عشان الديسك يطابقه.', e_ref: 'اكتب رقم العملية من الإيصال، 4 حروف أو أرقام على الأقل.',
    e_pick: 'اختار باقة وطريقة الدفع.', sendProof: 'ابعت لـ {g}', cashGo: 'هدفع في الديسك',
    noPkgs: '{g} لسه ما ضافتش باقات في التطبيق. اسأل الديسك.', noPay: '{g} لسه ما ظبطتش الدفع في التطبيق. ادفع في الديسك.',
    rnSent: 'اتبعت. {g} هتأكد.', rnGuest: 'تقدر تدفع دلوقتي. الديسك يوافق عليك ويأكد الدفع مع بعض.',
    pkgs: 'الباقات', howPay: 'طرق الدفع', payInstaL: 'عنوان إنستاباي', payWalletL: 'رقم المحفظة', payCashL: 'الكاش مقبول في الديسك.',
    rkFor: 'ليك', rkFeed: 'الفيد', rkReq: 'الطلبات', rkMine: 'رفقاتي',
    search: 'دوّر بالاسم', sugP: 'اللي بييجوا نفس وقتك الأول. محدش يقدر يكلمك قبل ما توافق.',
    noSug: 'مفيش اقتراحات دلوقتي. ضيف مواعيد تمرينك من "أنا" عشان نلاقي ناس بتيجي نفس وقتك.', noFound: 'مفيش حد بالاسم ده.',
    ovl: 'إنتوا الاتنين بتيجوا: {d}', sentAlready: 'الطلب اتبعت', answer: 'رد على الطلب', chat: 'شات',
    gateGuest: 'ده هيفتح لما {g} توافق عليك. قول للديسك إنك سجّلت.', gateExpired: 'اشتراكك خلص. جدّد عشان تشوف الناس ويشوفوك.',
    reqH: 'تتمرن مع {n}؟', type: 'النوع', whenDay: 'يوم إيه', whenR: 'إمتى', noFree: 'مفيش كلام حر قبل الموافقة، فالطلب عمره ما يشيل رقم تليفون ولا كلمة وحشة.',
    sendR: 'ابعت الطلب', reqSent: 'اتبعت. {n} شايفه دلوقتي.', e_slot: 'اختار اليوم والوقت.',
    inH2: 'مستنيينك', outH: 'إنت بعتّ', accept: 'موافق', notNowR: 'مش دلوقتي', waiting: 'مستني {n}', accepted: '{n} وافق', declinedOut: 'مش المرة دي', cancelledOut: 'اتلغى',
    cancelReq: 'الغي الطلب', noReq: 'مفيش طلبات مستنياك. ابعت واحد من "ليك".', noOut: 'لسه ما بعتّش طلبات.',
    acceptedT: 'إنت و{n} بقيتوا رفقة.', declinedT: 'الطلب اترفض.', cancelledT: 'الطلب اتلغى.',
    mineEmpty: 'لسه معندكش رفقة. ابعت "نتمرن سوا؟" لحد بييجي نفس وقتك.', noMsgs: 'لسه مفيش رسايل. سلّم.', youPfx: 'إنت: ', since: 'من {d}',
    goal: 'الهدف', level: 'بيتمرن بقاله', when: 'بييجي', block: 'بلوك', report: 'إبلاغ',
    blockH: 'تعمل بلوك لـ {n}؟', blockP: 'مش هتشوفوا بعض في أي مكان في التطبيق. أي رفقة أو طلب بينكم هيخلص. ومش هيعرف.', blocked: 'اتعمل بلوك. مش هتشوفوا بعض في أي مكان.',
    reportH: 'إبلاغ عن {n}', reportPostH: 'إبلاغ عن البوست ده', reportP: 'البلاغ بيروح لـ {g} بس. وصاحبه مش هيعرف.', reportDo: 'ابعت البلاغ', reported: 'البلاغ اتبعت لـ {g}. ومحدش هيعرف.',
    rs_harassment: 'مضايقة', rs_offensive: 'كلام أو تصرف مش كويس', rs_spam: 'حساب وهمي أو سبام', rs_other: 'حاجة تانية', e_reason: 'اختار السبب.',
    feedP: 'الجيم كله عيلة واحدة. أي حد يقدر يشوف بروفايلك بيشوف بوستاتك. الشات بيفضل خاص.',
    postPh: 'اكتب حاجة للجيم', addPhoto: 'ضيف صورة', chPhoto: 'غيّر الصورة', rmPhoto: 'شيل الصورة', postBtn: 'انشر', posted: 'اتنشرت في الفيد.', postSent: 'اتبعتت. هتظهر لما {g} توافق.',
    feedEmpty: 'لسه مفيش بوستات. ابدأ إنت.', respect: 'عاش!', respected: 'عاش! اتبعتت', respectN: '{n} عاش! (العدد ده بيظهر ليك إنت بس)', pendingP: 'مستني موافقة {g}',
    delPost: 'امسح', delPostH: 'تمسح البوست ده؟', delPostP: 'هيختفي من الفيد عند الكل.', deleted: 'البوست اتمسح.', more: 'ورّيني أكتر', postOpts: 'اختيارات البوست',
    e_post: 'اكتب حاجة أو ضيف صورة.', e_img: 'معرفناش نقرا الصورة دي. جرّب صورة تانية.', photoAlt: 'صورة نشرها {n}',
    typeMsg: 'رسالة', send: 'ابعت', chatEmpty: 'بقيتوا رفقة. سلّموا واتفقوا على ميعاد.', chatOpts: 'اختيارات الشات',
    endRefka: 'أنهي الرفقة دي', endH: 'تنهي رفقتك مع {n}؟', endP: 'الشات هيتقفل عندكم إنتوا الاتنين. وتقدر تبعت طلب جديد بعدين.', endDo: 'أنهي الرفقة', ended: 'الرفقة خلصت.',
    chatEnded: 'الرفقة دي خلصت، فالشات مقفول.', sendFail: 'ما اتبعتتش', resend: 'ابعتها تاني',
    editProfile: 'عدّل البروفايل', privacy: 'الخصوصية', lang: 'اللغة', signOut: 'خروج', signOutH: 'تخرج من الموبايل ده؟', signOutP: 'هتحتاج رقمك والرقم السري عشان ترجع.',
    bioL: 'جملة عنك (اختياري)', bioPh: 'مثلًا: بتمرن بالليل وشغال على السكوات', goalL: 'هدفك', levelL: 'بقالك قد إيه بتتمرن', timesL: 'بتيجي إمتى',
    timesH: 'اختار كل الأوقات اللي بتناسبك. بنستخدمها عشان نقترح عليك ناس.', savedT: 'اتحفظ.', e_name: 'اكتب اسمك.',
    pvSee: 'مين يشوف بروفايلي وبوستاتي',
    pvAll: 'كل اللي في {g}', pvAllP: 'أعضاء {g} يقدروا يشوفوا بروفايلك وبوستاتك ويبعتولك "نتمرن سوا؟". الراجل والست بيشوفوا بعض بس لو الاتنين اختاروا الاختيار ده.',
    pvAllPNoCross: 'في {g} الرجالة والستات مش بيشوفوا بعض في التطبيق، فاللي من نفس نوعك بس هم اللي بيشوفوك.',
    pvGender_m: 'الرجالة بس', pvGender_f: 'الستات بس',
    pvGenderP_m: 'الرجالة في {g} بس هم اللي يشوفوا بروفايلك وبوستاتك ويبعتولك طلبات. الستات مش هيشوفوك.', pvGenderP_f: 'الستات في {g} بس هم اللي يشوفوا بروفايلك وبوستاتك ويبعتولك طلبات. الرجالة مش هيشوفوكي.',
    pvNone: 'محدش', pvNoneP: 'مش هتظهر في "ليك" ولا في الفيد، ومحدش يقدر يبعتلك طلب. الرفقات اللي عندك يقدروا يكلموك عادي.',
    pvReq: 'أيًّا كان اختيارك، محدش يقدر يكلمك قبل ما توافق على طلبه.', pvMinor: 'عشان سنك أقل من 18، الأعضاء اللي أقل من 18 بس هم اللي بيشوفوك، وإنت بتشوفهم هم بس.',
    e_joinDup: 'الرقم ده مربوط بحساب تاني في الجيم ده. اسأل الديسك.', e_joinFull: 'الجيم مش بتقبل تسجيل جديد من التطبيق دلوقتي. اسأل الديسك.',
    limitPost: 'وصلت لحد البوستات بتاع النهارده. جرّب بكرة.', limitChat: 'بتبعت بسرعة. استنى شوية.', limitReport: 'بعتّ بلاغات كتير النهارده. لو الموضوع مستعجل كلّم الديسك.',
    st_hidden: 'الجيم خفت البوست ده', joinAgainP: 'عندك حساب على Refka باسم {n}. ادخل {g} بنفس البروفايل.', viewProfile: 'شوف البروفايل',
    avatarL: 'صورة البروفايل', yourNumber: 'رقمك', hiddenChat: 'إنتوا الاتنين مبقاش ينفع تشوفوا بعض، فالشات اتقفل.', memEnded: 'اشتراكك خلص.',
    signedOutT: 'الجلسة خلصت. ادخل تاني.', unread: 'جديد', e_nameShort: 'اسمك لازم يكون حرفين على الأقل.', codeIn: 'كود جديد بعد {s} ثانية',
    justNow: 'دلوقتي', agoM: 'من {n} دقيقة', agoH: 'من {n} ساعة', agoD: 'من {n} يوم',
  },
};

// Friendly text for every error code in the contract, plus the auth codes from lib/api.js.
export const ERR = {
  en: {
    not_auth: 'Your session ended. Sign in again.', not_owner: 'This is for the gym owner only.', not_member: 'You are not an active member of this gym yet.',
    not_found: 'We could not find that. It may have been removed.', bad_input: 'Something in what you entered is not right. Check it and try again.',
    slug_taken: 'That link name is taken.', slug_bad: 'That link name is not valid.', need_package: 'The gym needs at least one package first.', need_pay: 'The gym needs a payment method first.',
    before_needs_until: 'An offer price needs an end date.', limit: 'You sent 5 requests today. Try again tomorrow.', dup: 'You already have an open request with this person.',
    hidden: 'This person is not taking requests right now.', blocked: 'You cannot contact this person.', posts_off: 'The gym has member posts turned off.',
    expired: 'Your membership has ended. Renew to use this.', pending_exists: 'You already have a payment waiting for the gym to confirm.',
    account_exists: 'This number already has an account. Check the PIN, or ask your gym to reset it.', bad_login: 'The number or PIN is not right.',
    slow_down: 'Too many tries. Wait a minute and try again.', auth_failed: 'We could not sign you in. Try again.',
    offline: 'No internet. Check your connection and try again.', unknown: 'Something went wrong. Try again.',
  },
  ar: {
    not_auth: 'الجلسة خلصت. ادخل تاني.', not_owner: 'ده لصاحب الجيم بس.', not_member: 'إنت لسه مش عضو شغّال في الجيم ده.',
    not_found: 'مش لاقيين ده. ممكن يكون اتمسح.', bad_input: 'في حاجة مش مظبوطة في اللي كتبته. راجعه وجرّب تاني.',
    slug_taken: 'اسم اللينك ده متاخد.', slug_bad: 'اسم اللينك ده مش مظبوط.', need_package: 'الجيم محتاجة باقة واحدة على الأقل الأول.', need_pay: 'الجيم محتاجة طريقة دفع الأول.',
    before_needs_until: 'سعر العرض محتاج تاريخ انتهاء.', limit: 'بعتّ 5 طلبات النهارده. جرّب بكرة.', dup: 'عندك طلب مفتوح مع الشخص ده.',
    hidden: 'الشخص ده مش بيستقبل طلبات دلوقتي.', blocked: 'مش هتقدر تتواصل مع الشخص ده.', posts_off: 'الجيم قافلة بوستات الأعضاء.',
    expired: 'اشتراكك خلص. جدّد عشان تستخدم ده.', pending_exists: 'عندك دفعة مستنية تأكيد الجيم.',
    account_exists: 'الرقم ده عليه حساب. راجع الرقم السري، أو اطلب من الجيم يظبطه.', bad_login: 'الرقم أو الرقم السري مش صح.',
    slow_down: 'محاولات كتير. استنى دقيقة وجرّب تاني.', auth_failed: 'معرفناش ندخّلك. جرّب تاني.',
    offline: 'مفيش نت. راجع الاتصال وجرّب تاني.', unknown: 'حصلت مشكلة. جرّب تاني.',
  },
};

const LS = 'rf_lang';
function initialLang() {
  try { const s = localStorage.getItem(LS); if (s === 'ar' || s === 'en') return s; } catch (e) { /* private mode */ }
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  return /^ar\b/i.test(langs[0] || '') ? 'ar' : 'en';
}
let cur = initialLang();
export const lang = () => cur;
export function setLang(l) {
  cur = l === 'ar' ? 'ar' : 'en';
  try { localStorage.setItem(LS, cur); } catch (e) { /* ignore */ }
  applyLang();
}
export function applyLang() {
  document.documentElement.lang = cur;
  document.documentElement.dir = cur === 'ar' ? 'rtl' : 'ltr';
}
export function t(k, v) {
  let s = T[cur][k];
  if (s == null) s = T.en[k];
  if (s == null) return k;
  if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x] == null ? '' : String(v[x]));
  return s;
}
export const has = k => T.en[k] != null;
// Known key -> label; unknown value (older data, another client) -> shown as it is.
// Older or hand-made data may hold free text ("Build muscle", "Intermediate", "night") instead of a key.
const ALIAS = { x_: { beginner: 'new', intermediate: 'mid', advanced: 'adv', pro: 'pro', expert: 'pro' }, s_: { night: 'late', noon: 'afternoon' } };
export function keyOf(prefix, val) {
  if (val == null || val === '') return null;
  const v = String(val);
  if (has(prefix + v)) return v;
  const lc = v.trim().toLowerCase();
  if (ALIAS[prefix] && ALIAS[prefix][lc]) return ALIAS[prefix][lc];
  for (const k in T.en) if (k.startsWith(prefix) && (T.en[k].toLowerCase() === lc || T.ar[k] === v.trim())) return k.slice(prefix.length);
  return null;
}
export const label = (prefix, val) => { if (val == null || val === '') return ''; const k = keyOf(prefix, val); return k ? t(prefix + k) : String(val); };
export const L = (en, ar) => (cur === 'ar' ? (ar || en) : (en || ar)) || '';

export function errCode(e) {
  if (e && e.code) {
    // PostgREST answers "permission denied" (42501) when the request went out without a session
    // (signed out in another tab, refresh token gone): that is a lost session, not a generic failure.
    if (e.code === 'unknown' && e.raw && e.raw.code === '42501') return 'not_auth';
    if (e.code === 'unknown' || e.code === 'auth_failed') {
      const m = String((e.raw && e.raw.message) || '').toLowerCase();
      if ((typeof navigator !== 'undefined' && navigator.onLine === false) || m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) return 'offline';
    }
    return e.code;
  }
  return 'unknown';
}
export function errText(e) { const c = errCode(e); return ERR[cur][c] || ERR[cur].unknown; }

const MON = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};
// Accepts 'YYYY-MM-DD' (a calendar date, no timezone shift) or a timestamp.
export function toDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'number') return new Date(d < 1e12 ? d * 1000 : d);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date(d);
}
export function fdate(d) {
  const x = toDate(d);
  if (isNaN(x)) return '';
  const y = x.getFullYear() !== new Date().getFullYear() ? ' ' + x.getFullYear() : '';
  return x.getDate() + ' ' + MON[cur][x.getMonth()] + y;
}
export function ftime(d) {
  const x = toDate(d);
  if (isNaN(x)) return '';
  return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
}
export function ago(d) {
  const x = toDate(d);
  if (isNaN(x)) return '';
  const s = Math.max(0, (Date.now() - x.getTime()) / 1000);
  if (s < 60) return t('justNow');
  if (s < 3600) return t('agoM', { n: Math.floor(s / 60) });
  if (s < 86400) return t('agoH', { n: Math.floor(s / 3600) });
  if (s < 7 * 86400) return t('agoD', { n: Math.floor(s / 86400) });
  return fdate(x);
}
export function money(n, cur3) {
  const v = Number(n || 0).toLocaleString('en-US');
  const c = cur3 || 'EGP';
  if (cur === 'ar') return v + ' ' + (c === 'EGP' ? 'ج.م' : c);
  return c + ' ' + v;
}
export function months(n) {
  n = Number(n) || 0;
  if (cur === 'ar') return n === 1 ? 'شهر' : n === 2 ? 'شهرين' : n <= 10 ? n + ' شهور' : n + ' شهر';
  return n === 1 ? t('month1') : t('monthN', { n });
}
const localISO = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
export function dayLabel(iso) {
  const x = toDate(iso);
  if (isNaN(x)) return String(iso || '');
  const now = new Date();
  const tm = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (localISO(x) === localISO(now)) return t('today');
  if (localISO(x) === localISO(tm)) return t('tomorrow');
  return t('d' + x.getDay()) + ' ' + fdate(x);
}
export { localISO };
// A request slot is '<YYYY-MM-DD>:<time key>' (for example 2026-11-16:evening). Anything else is shown as it is.
export function slotLabel(slot) {
  const m = /^(\d{4}-\d{2}-\d{2}):([a-z]+)$/.exec(String(slot || ''));
  if (!m) return label('s_', slot);
  return dayLabel(m[1]) + ' · ' + label('s_', m[2]);
}
