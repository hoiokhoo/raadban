// بررسی ساختار آواتار در HTML سندیکاسیون ایکس — یک‌بار مصرف
const r = await fetch('https://syndication.twitter.com/srv/timeline-profile/screen-name/realDonaldTrump?showReplies=false', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
});
const body = await r.text();
console.log('status:', r.status, 'len:', body.length);
const avatars = [...body.matchAll(/https:\/\/pbs\.twimg\.com\/profile_images[^"'\s\\]+/g)].slice(0, 3).map((m) => m[0]);
console.log('avatar urls:', avatars);
const names = body.match(/"name":"[^"]+"/g)?.slice(0, 3);
console.log('name fields:', names);
const nextData = body.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>/);
console.log('has __NEXT_DATA__:', Boolean(nextData));
process.exit(0);
