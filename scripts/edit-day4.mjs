// Day4記事にエピソード4件を追加するスクリプト
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/blog-data.json';
const data = JSON.parse(readFileSync(filePath, 'utf-8'));

// Day4 = 最初のエントリ（最新が先頭）
const day4 = data[0];
if (!day4.title.includes('Day 4')) {
    console.error('先頭がDay4ではありません:', day4.title);
    process.exit(1);
}

let content = day4.content;

// ===== エピソード#2: ケース4（修正中にトークン上限到達）=====
const case3End = 'これが「AIの記憶消失」がもたらした最大の被害でした。</p>';
const case4Html = `これが「AIの記憶消失」がもたらした最大の被害でした。</p>\\n` +
    `<h3>ケース4：修正中に記憶が飛ぶ</h3>\\n` +
    `<p>ある日、AIが本来読み込むべきルールファイルを読み込んでいなかったことに気づきました。「このルールを修正して」と指示し、AIは修正作業に取りかかりました。</p>\\n` +
    `<p>ところが、まさに修正の途中で<strong>トークン上限に到達</strong>。会話がリセットされ、「何を修正していたのか」「なぜ修正が必要だったのか」という文脈がすべて消えてしまいました。</p>\\n` +
    `<p>メタ的な皮肉です——<strong>「AIの記憶問題」を修正している最中に、AIの記憶が飛んだ</strong>のですから。次の会話で最初から説明し直す羽目になりました。</p>`;
content = content.replace(case3End, case4Html);

// ===== エピソード#4: ケース5（git commit停滞ループ）=====
// ケース4の後、<hr>の前に追加
const beforeHrAfterCases = '次の会話で最初から説明し直す羽目になりました。</p>\\n<hr>';
const case5Html = `次の会話で最初から説明し直す羽目になりました。</p>\\n` +
    `<h3>ケース5：自分で決めたルールを忘れてループする</h3>\\n` +
    `<p>AIと一緒に「コマンドが応答しなくなったら、すぐ中断してやり直す」というルールを作りました。しかし、このルール自体に<strong>環境の特性が考慮されていなかった</strong>のです。</p>\\n` +
    `<p>開発マシンでは特定の操作に10秒以上かかることがありますが、AIはそれを「応答なし＝異常」と判断。中断→再実行→また「応答なし」→中断→再実行……という<strong>無限ループ</strong>に陥りました。</p>\\n` +
    `<p>実はすべて正常に完了していたのに、「遅い＝壊れた」と誤判定し続けた。<strong>ルールを作った本人（AI）がそのルールの欠陥に気づけない</strong>——これもまた、記憶の限界がもたらす問題です。AIには「前回も同じことをした」という記憶がないため、同じ誤判定を繰り返します。</p>\\n<hr>`;
content = content.replace(beforeHrAfterCases, case5Html);

// ===== エピソード#1: 会話ログセクション拡張 =====
const logSectionBrief = '<strong>教訓：AIの自己報告を信じるな。物理的な証拠で検証しろ。</strong></p>';
const logSectionExpanded = `<strong>教訓：AIの自己報告を信じるな。物理的な証拠で検証しろ。</strong></p>\\n` +
    `<h3>具体例：Bluesky統合時の「嘘報告」</h3>\\n` +
    `<p>SNS自動投稿機能を開発した際のことです。長時間のセッションの終わりに、AIは「障害記録を作成しました」「ログを保存済みです」と報告してきました。</p>\\n` +
    `<p>しかし次の会話で前回の内容を確認しようとしたところ、<strong>ログファイルがどこにも存在しない</strong>。AIは「保存した」と信じ込んでいたのですが、実際にはファイル作成のコマンドを実行していなかったのです。</p>\\n` +
    `<p>これは「嘘をついた」のではなく、コンテキストウィンドウの圧迫で<strong>「やったつもりになった」</strong>状態です。長いセッションの後半ほど、このリスクは高まります。</p>`;
content = content.replace(logSectionBrief, logSectionExpanded);

// ===== エピソード#3: ワークフローセクション拡張（保存分割）=====
const workflowEnd = '開発に着手できるまでの時間が<strong>10分→30秒</strong>に短縮されました。</p>';
const workflowExpanded = `開発に着手できるまでの時間が<strong>10分→30秒</strong>に短縮されました。</p>\\n` +
    `<h3>保存ワークフローの分割 — フリーズとの戦い</h3>\\n` +
    `<p>もう1つ工夫したのが、<strong>会話終了時の保存処理を軽量化</strong>したことです。</p>\\n` +
    `<p>当初は会話の最後に計画書・更新履歴・開発ヒストリー・会話ログを一括更新していましたが、長いセッションの後のAIにはもう余力がなく、<strong>途中でフリーズ</strong>してしまうことが何度も。</p>\\n` +
    `<p>そこで「軽量保存」と「本格更新」を分離しました。会話の最後は最低限のメモだけ残し、次の会話の冒頭で本格的なドキュメント更新を行う。<strong>AIの記憶は会話をまたげない</strong>制約を逆手に取り、「引き継ぎメモ」で会話間の連続性を確保する仕組みです。</p>`;
content = content.replace(workflowEnd, workflowExpanded);

// まとめテーブルも更新（構築したもの にケース追加）
const summaryOld = 'スキルシステム（20個）、再発防止ルール集、KI連携、GPロードワークフロー';
const summaryNew = 'スキルシステム（20個）、再発防止ルール集、KI連携、GPロードワークフロー、保存ワークフロー分割';
content = content.replace(summaryOld, summaryNew);

// 保存
day4.content = content;
writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

console.log('✅ Day4記事を更新しました');
console.log('追加したエピソード:');
console.log('  1. ケース4: 修正中にトークン上限到達');
console.log('  2. ケース5: git commit停滞ループ');
console.log('  3. Bluesky統合時の嘘報告（会話ログセクション拡張）');
console.log('  4. 保存ワークフロー分割（ワークフローセクション拡張）');
