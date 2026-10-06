import { LegalPage, List, Section } from "@/components/LegalPage";

export const metadata = {
  title: "隱私權政策 — Video Speed Reader",
  description: "Video Speed Reader 如何蒐集、使用、保存與保護你的個人資料。",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="隱私權政策"
      updated="2026 年 10 月 6 日"
      intro={
        <p>
          Video Speed
          Reader（以下稱「本服務」）重視你的隱私。本政策說明我們蒐集哪些資料、如何使用與保存，以及你可以行使的權利。本政策依中華民國《個人資料保護法》訂定。
        </p>
      }
    >
      <Section title="一、我們蒐集的資料">
        <List>
          <li>
            <strong>帳號資料：</strong>Email、密碼（以加密雜湊方式保存，我們看不到原始密碼）。使用
            Google 登入時，會取得你的 Google 帳號 Email 與基本資料。
          </li>
          <li>
            <strong>你提供的內容：</strong>
            上傳的影片或音檔、提供的影片連結、填寫的主題與語言，以及系統產出的逐字稿與摘要。
          </li>
          <li>
            <strong>交易資料：</strong>
            點數購買與使用紀錄（時間、方案、點數）。信用卡資料由金流服務商直接處理，本服務不會取得或儲存完整卡號。
          </li>
          <li>
            <strong>客服資料：</strong>你透過聯絡客服表單或 Email 提供的問題內容與聯絡資訊。
          </li>
          <li>
            <strong>技術資料：</strong>維持登入狀態所需的 Cookie，以及伺服器自動產生的基本紀錄（如
            IP 位址、瀏覽器類型、錯誤紀錄），用於安全防護與除錯。
          </li>
        </List>
      </Section>

      <Section title="二、使用目的">
        <List>
          <li>提供逐字稿、摘要、點數與帳號管理等服務。</li>
          <li>處理付款、退款與客服需求。</li>
          <li>
            寄送帳號相關通知（如驗證信、重設密碼、客服回覆）。我們不會在未經你同意下寄送行銷信件。
          </li>
          <li>維護系統安全、防止濫用，以及改善服務品質。</li>
        </List>
      </Section>

      <Section title="三、委託處理的第三方服務">
        <p>為提供服務，你的資料會由下列服務商在必要範圍內處理，部分服務商位於中華民國境外：</p>
        <List>
          <li>
            <strong>Supabase：</strong>會員帳號與資料庫（逐字稿、摘要、點數紀錄、客服紀錄）。
          </li>
          <li>
            <strong>Amazon Web Services（AWS，日本東京區域）：</strong>
            暫存你上傳的檔案，以及執行轉錄處理。
          </li>
          <li>
            <strong>OpenAI：</strong>將音訊轉為逐字稿（Whisper），以及產生重點摘要。依 OpenAI 的 API
            政策，透過 API 傳送的資料預設不會被用來訓練其模型。
          </li>
          <li>
            <strong>Vercel：</strong>網站主機。
          </li>
          <li>
            <strong>Resend、ImprovMX：</strong>寄送系統通知信，以及轉寄客服信件。
          </li>
          <li>
            <strong>金流服務商：</strong>處理信用卡付款。
          </li>
        </List>
        <p>
          我們不會出售你的個人資料，也不會將你的內容提供給上述以外的第三方，法律另有規定者除外。
        </p>
      </Section>

      <Section title="四、保存期限">
        <List>
          <li>
            <strong>上傳的原始檔案：</strong>上傳後約 1
            天自動刪除。轉錄處理時產生的暫存檔，也會在伺服器上定期清除。
          </li>
          <li>
            <strong>逐字稿、摘要與影片連結：</strong>保存至你刪除帳號為止，方便你隨時回來下載。
          </li>
          <li>
            <strong>帳號、交易與客服紀錄：</strong>
            保存至你刪除帳號為止；交易紀錄可能依法律或會計規定保存較長時間。
          </li>
        </List>
      </Section>

      <Section title="五、你的權利">
        <p>依《個人資料保護法》，你可以向我們請求：</p>
        <List>
          <li>查詢、閱覽或取得你的個人資料複本。</li>
          <li>補充或更正你的個人資料。</li>
          <li>停止蒐集、處理或利用你的個人資料。</li>
          <li>刪除你的個人資料或帳號（刪除後，逐字稿與未使用的點數將無法復原）。</li>
        </List>
        <p>請透過聯絡客服提出，我們會在確認身分後盡快處理。</p>
      </Section>

      <Section title="六、資料安全">
        <p>
          我們採取合理的安全措施保護你的資料，包括全站 HTTPS
          加密傳輸、資料庫存取權限控管（每位會員只能讀取自己的資料），以及上傳檔案的私有儲存空間。但網路傳輸無法保證絕對安全，請妥善保管你的帳號密碼。
        </p>
      </Section>

      <Section title="七、Cookie">
        <p>
          本服務只使用維持登入狀態等必要功能所需的 Cookie。若你在瀏覽器停用
          Cookie，將無法登入使用本服務。
        </p>
      </Section>

      <Section title="八、兒童隱私">
        <p>本服務不以未滿 18 歲的未成年人為對象。未成年人使用本服務，應經法定代理人同意。</p>
      </Section>

      <Section title="九、政策修改">
        <p>本政策修改時會公告於本頁並更新日期；重大變更將以網站公告或 Email 通知。</p>
      </Section>
    </LegalPage>
  );
}
