import Link from "next/link";
import { LegalPage, List, Section } from "@/components/LegalPage";

export const metadata = {
  title: "退款政策 — Video Speed Reader",
  description: "Video Speed Reader 點數的退款條件、計算方式與申請流程。",
};

export default function RefundPage() {
  return (
    <LegalPage
      title="退款政策"
      updated="2026 年 10 月 6 日"
      intro={
        <p>
          我們希望你買得安心。本政策說明購買點數後，在什麼情況下可以申請退款，以及如何申請。購買點數前，請先閱讀本政策與
          <Link href="/terms" className="text-primary hover:underline">
            服務條款
          </Link>
          。
        </p>
      }
    >
      <Section title="一、7 天內未使用的點數可以退款">
        <p>
          購買後 7
          天內（含購買當日），該筆購買的點數中尚未使用的部分，可以申請退款。退款金額按比例計算：
        </p>
        <p className="rounded-lg bg-surface-bright px-4 py-3 text-sm">
          退款金額 ＝該筆實付金額 × 未使用點數 ÷ 該筆購買點數
        </p>
        <p>
          例如：以 NT$320 購買 150 點，使用了 30 點後申請退款，可退 NT$320 × 120 ÷ 150 ＝
          NT$256。帳戶裡同時有註冊贈點與購買點數時，系統會優先視為先使用贈送點數，再使用購買點數。
        </p>
      </Section>

      <Section title="二、系統問題造成的損失，會退還點數">
        <List>
          <li>逐字稿處理失敗時，系統不會扣點，你不需要申請退款。</li>
          <li>
            若因本服務的系統錯誤，導致已扣點但無法取得逐字稿，或產出內容明顯異常（例如整段空白或與影片完全無關），請在
            30 天內聯絡客服，我們確認後會退還該次扣除的點數。
          </li>
          <li>AI 轉錄有一般程度的錯字或辨識誤差，屬於服務的正常限制，不在退點範圍內。</li>
        </List>
      </Section>

      <Section title="三、不適用退款的情況">
        <List>
          <li>超過購買後 7 天的購買點數。</li>
          <li>已使用的點數（第二點的系統問題除外）。</li>
          <li>註冊贈送或活動贈送的點數，這些點數不得兌換現金。</li>
          <li>因違反服務條款而被暫停或終止的帳號。</li>
        </List>
      </Section>

      <Section title="四、如何申請">
        <List>
          <li>
            登入後到
            <Link href="/support" className="mx-1 text-primary hover:underline">
              聯絡客服
            </Link>
            ，類別選「點數與付款」，並註明購買日期與方案。
          </li>
          <li>我們會在收到申請後 3 個工作天內回覆。</li>
          <li>
            退款核准後，款項會退回原付款的信用卡，實際入帳時間依金流服務商與發卡銀行作業而定，一般約
            7 至 14 個工作天。退款完成後，對應的點數會從你的帳戶扣除。
          </li>
        </List>
      </Section>

      <Section title="五、服務停止時">
        <p>
          若本服務未來停止營運，將提前公告，並按比例退還帳戶中未使用的購買點數，不受上述 7
          天的限制。
        </p>
      </Section>
    </LegalPage>
  );
}
