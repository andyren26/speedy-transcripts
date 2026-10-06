import Link from "next/link";
import { LegalPage, List, Section } from "@/components/LegalPage";

export const metadata = {
  title: "服務條款 — Video Speed Reader",
  description: "Video Speed Reader 的服務條款：帳號、點數、使用規範與責任。",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="服務條款"
      updated="2026 年 10 月 6 日"
      intro={
        <p>
          歡迎使用 Video Speed Reader（以下稱「本服務」，網址
          ai-video-speed-reader.valuetrack66.com）。本服務提供影片與音檔的 AI
          逐字稿及重點摘要。註冊帳號或使用本服務，即表示你已閱讀並同意本服務條款、
          <Link href="/privacy" className="text-primary hover:underline">
            隱私權政策
          </Link>
          與
          <Link href="/refund" className="text-primary hover:underline">
            退款政策
          </Link>
          。
        </p>
      }
    >
      <Section title="一、帳號">
        <List>
          <li>你可以使用 Email 或 Google 帳號註冊。請提供正確的 Email，以便接收帳號與客服通知。</li>
          <li>你應妥善保管帳號與密碼，透過你的帳號進行的操作視為你本人所為。</li>
          <li>每人以一個帳號為原則，不得以大量註冊帳號等方式重複領取註冊贈點。</li>
        </List>
      </Section>

      <Section title="二、點數與計費">
        <List>
          <li>
            本服務以點數計費：1 點可轉錄 1 分鐘的影片或音檔。影片長度不足 1 分鐘的部分以 1
            分鐘計，每支影片最少扣 1 點。
          </li>
          <li>扣點以系統實際處理的音訊長度為準，並只在逐字稿成功完成後扣點；處理失敗不會扣點。</li>
          <li>點數不足時，該影片不會被處理，也不會扣點。</li>
          <li>新註冊會員可獲得贈送點數，贈送點數不得兌換現金。</li>
          <li>
            購買的點數沒有使用期限，但僅限本人帳號使用，不得轉讓或兌換現金（依退款政策辦理退款者除外）。
          </li>
          <li>
            點數方案的價格以購買頁面顯示為準。在台灣以新台幣付款，海外以美元付款。價格調整不影響你已購買的點數。
          </li>
          <li>信用卡付款由第三方金流服務商處理，本服務不會儲存你的完整信用卡號碼。</li>
        </List>
      </Section>

      <Section title="三、你上傳的內容">
        <List>
          <li>
            你應確保自己有權使用上傳或提供連結的影片、音檔（例如是你自己製作、已取得授權，或屬於合理使用範圍），並自行承擔相關責任。請勿上傳侵害他人著作權、肖像權、隱私權，或其他違法的內容。
          </li>
          <li>
            為了提供服務，你同意本服務及受託處理的第三方服務商（如
            OpenAI）在必要範圍內處理你的內容，詳見隱私權政策。
          </li>
          <li>上傳的原始檔案會在上傳後約 1 天自動刪除，請自行保留備份。</li>
        </List>
      </Section>

      <Section title="四、產出內容的權利">
        <List>
          <li>
            本服務產出的逐字稿與摘要歸你所有，你可以自由使用、修改，包括用於商業用途。本服務不主張任何權利。
          </li>
          <li>但若原始影片的權利屬於他人，你使用產出內容時仍須遵守原始內容的授權範圍。</li>
        </List>
      </Section>

      <Section title="五、AI 產出的準確性">
        <p>
          逐字稿與摘要由 AI
          自動產生，可能因口音、多人同時說話、背景噪音、專有名詞或錄音品質而出現錯誤或遺漏。本服務不保證產出內容完全正確，用於正式場合（如法律、醫療、財務、出版）前，請自行核對原始內容。
        </p>
      </Section>

      <Section title="六、禁止行為">
        <List>
          <li>以任何方式干擾、攻擊或試圖未經授權存取本服務的系統。</li>
          <li>以自動化程式大量呼叫本服務，或利用系統漏洞取得點數。</li>
          <li>將本服務用於任何違法用途。</li>
        </List>
        <p>違反上述規定時，本服務得暫停或終止你的帳號，並保留追究責任的權利。</p>
      </Section>

      <Section title="七、服務變更與中斷">
        <p>
          本服務會盡力維持穩定運作，但可能因系統維護、第三方服務異常或不可抗力而暫時中斷。本服務得調整或停止部分功能；若未來停止提供服務，將提前公告，並依退款政策處理你帳戶中未使用的購買點數。
        </p>
      </Section>

      <Section title="八、責任限制">
        <p>
          在法律允許的範圍內，本服務對於因使用或無法使用本服務所生的間接損失不負賠償責任；對你的賠償總額，以你在事件發生前
          12 個月內實際支付給本服務的金額為上限。
        </p>
      </Section>

      <Section title="九、條款修改">
        <p>
          本服務得修改本條款，修改後會公告於本頁並更新日期。重大變更將以網站公告或 Email
          通知。修改後你繼續使用本服務，即視為同意修改後的條款。
        </p>
      </Section>

      <Section title="十、準據法與管轄">
        <p>
          本條款以中華民國法律為準據法。因本服務所生的爭議，雙方同意先以誠信協商解決；協商不成時，以服務提供者所在地之地方法院為第一審管轄法院。
        </p>
      </Section>
    </LegalPage>
  );
}
