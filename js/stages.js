// ステージデータとストーリー (ここを書きかえればコースの長さ・ライバルの速さ・じゃまものの数を調整できます)
//
// length   : ゴールまでの距離 (px。10px = 1m)
// kids     : ライバル 4 人の基本の速さ (ポポのふつうの速さは 200)
// hazards  : じゃまものの数 { cat, monkey, fish }  (fish = さかなやのおやじ)
// puddle / pad / candy : みずたまり・ダッシュパネル・こんぺいとう列の数
// catSmart : 1 にすると、ねこが途中でポポのレーンに向き直る
// fishSpeed: おやじが追いかけてくる最高速度
// clearRank: この順位以内でクリア
(() => {
  "use strict";

  const STAGES = [
    {
      id: 1, theme: "river", music: "river", name: "かわらの かけっこ", en: "RIVERSIDE RUN",
      length: 12000, kids: { mei: 172, riko: 176, haruto: 181, sota: 186 },
      hazards: { cat: 7, monkey: 0, fish: 0 }, puddle: 5, pad: 4, candy: 10, catSmart: 0, fishSpeed: 240, clearRank: 3,
      intro: [
        ["yuta", "ポポ！ きょうは かわらで\nこどもかけっこたいかい だって！"],
        ["popo", "ポポ〜！\n（ポポも でる！ うちゅうせんで！）"],
        ["yuta", "うちゅうせんで!?\n…まあ いっか。ぼくが おうえん するね！"],
        ["yuta", "でも ねこに きをつけて。\nポポの こと おもちゃだと おもってるんだ"],
        ["yuta", "↑↓で レーンを かえて よけてね。\nA（Space）で ジャンプも できるよ！"],
      ],
      tips: "↑↓ で レーンを かえて、ねこを よけよう！",
    },
    {
      id: 2, theme: "town", music: "town", name: "しょうてんがい ダッシュ", en: "SHOPPING STREET",
      length: 13500, kids: { mei: 177, riko: 182, haruto: 187, sota: 192 },
      hazards: { cat: 4, monkey: 0, fish: 2 }, puddle: 4, pad: 4, candy: 10, catSmart: 0, fishSpeed: 245, clearRank: 3,
      intro: [
        ["yuta", "つぎは しょうてんがい コースだよ！"],
        ["yuta", "あっ、さかなやの おじさんが いる…\nポポの こと タコだと おもってるんだ"],
        ["fish", "む！ あの ピンクの…\nあれは でっかい タコだな!?"],
        ["popo", "ポポ タコじゃ ないポ〜！"],
        ["yuta", "つかまったら ボタンを\nれんだして にげるんだ！"],
        ["yuta", "→を おしっぱなしで ダッシュ！\nこんぺいとうで パワーが たまるよ"],
      ],
      tips: "→ で ダッシュ。おじさんは ダッシュか ジャンプで かわそう",
    },
    {
      id: 3, theme: "forest", music: "forest", name: "おさるの もり", en: "MONKEY FOREST",
      length: 15000, kids: { mei: 181, riko: 186, haruto: 191, sota: 196 },
      hazards: { cat: 2, monkey: 7, fish: 0 }, puddle: 5, pad: 5, candy: 12, catSmart: 1, fishSpeed: 245, clearRank: 3,
      intro: [
        ["yuta", "やまの こうえんには\nおさるが たくさん いるんだ"],
        ["yuta", "おさるは バナナの かわを\nなげてくるよ！"],
        ["popo", "ポポ…（ゴクリ）"],
        ["yuta", "かげが みえたら そこに おちてくる。\nレーンを かえるか ジャンプだ！"],
        ["yuta", "ぼくも とちゅうで アイテムを\nとどけるからね！ B（X）で つかって！"],
      ],
      tips: "バナナの かげを みたら レーンを かえるか ジャンプ！",
    },
    {
      id: 4, theme: "port", music: "port", name: "ゆうやけ みなとまち", en: "SUNSET HARBOR",
      length: 16000, kids: { mei: 184, riko: 189, haruto: 195, sota: 200 },
      hazards: { cat: 4, monkey: 2, fish: 3 }, puddle: 4, pad: 5, candy: 12, catSmart: 1, fishSpeed: 255, clearRank: 3,
      intro: [
        ["yuta", "みなとまちは さかなやさんの\nなかまが いっぱい…"],
        ["fish", "きょうこそ あの タコを\nつかまえて みせるぞー！"],
        ["popo", "ポポ〜〜!!"],
        ["yuta", "だいじょうぶ！ いざと なったら\nにぼしを なげれば いいよ"],
        ["yuta", "おじさんも ねこも おさるも\nにぼしに むちゅうに なるんだ"],
      ],
      tips: "にぼしを つかうと じゃまものが みんな むちゅうに なる！",
    },
    {
      id: 5, theme: "festival", music: "festival", name: "なつまつり グランプリ", en: "FESTIVAL GRAND PRIX",
      length: 18000, kids: { mei: 186, riko: 192, haruto: 198, sota: 205 },
      hazards: { cat: 4, monkey: 4, fish: 3 }, puddle: 3, pad: 6, candy: 14, catSmart: 1, fishSpeed: 265, scooter: true, clearRank: 3,
      intro: [
        ["yuta", "いよいよ さいごの レース！\nなつまつり グランプリだ！"],
        ["haruto", "ポポには まけないぞ！\nこんどこそ 1いだ！"],
        ["fish", "スクーターを もってきたぞ！\nこんやは タコやきパーティーだ！"],
        ["popo", "ポ、ポポ〜!?"],
        ["yuta", "ポポ、がんばって！\n1いに なったら りんごあめ かってあげる！"],
      ],
      tips: "さいごの レース！ ダッシュと アイテムを うまく つかおう",
    },
  ];

  // エンディング (ステージ 5 の順位でセリフが少しかわる)
  function ENDING(rank) {
    const win = rank === 1;
    return [
      win ? ["yuta", "やったね ポポ！\nなつまつり グランプリ ゆうしょうだ！"] : ["yuta", `${rank}いで ゴール！\nさいごまで よく がんばったね ポポ！`],
      win ? ["haruto", "うちゅうせん ずるいよ〜！\nでも はやかった！ また やろうね！"] : ["haruto", "へへん、こんどは ぼくらの かちだね！\nでも たのしかった！ また やろうね！"],
      ["fish", "いやあ わるかった！\nタコだと おもって おいかけちまった"],
      ["fish", "おわびに これ やるよ。\nうちの とくせい たこやき だ！"],
      ["popo", "…タコ!?\nポポ〜〜〜!?"],
      win ? ["yuta", "あはは！ りんごあめも かったからね。\nいっしょに たべよう！"] : ["yuta", "あはは！ ポポは タコじゃ ないから\nだいじょうぶだよ。いっしょに たべよう！"],
      ["popo", "ポポ♪\n（ちきゅうって たのしいポ！）"],
    ];
  }

  const NAMES = { yuta: "ユウタ", popo: "ポポ", fish: "さかなやの おじさん", haruto: "ハルト", mei: "メイ", sota: "ソウタ", riko: "リコ" };

  window.PopoStages = { STAGES, ENDING, NAMES };
})();
