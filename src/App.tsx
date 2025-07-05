import { useState, useEffect } from 'react';
import { BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface AddressForm {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  building: string;
}

const formSubject$ = new BehaviorSubject<AddressForm>({
  postalCode: '',
  prefecture: '',
  city: '',
  town: '',
  building: '',
});

function App() {
  const [form, setForm] = useState<AddressForm>({
    postalCode: '',
    prefecture: '',
    city: '',
    town: '',
    building: '',
  });

  const [isValid, setIsValid] = useState(false);
  
  // 【日本語IME制御】未確定状態を管理
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    const subscription = formSubject$
      .pipe(
        debounceTime(50),
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        )
      )
      .subscribe((formData: AddressForm) => {
        // setForm(formData); // 重複更新を防ぐため削除
        setIsValid(
          formData.postalCode.length >= 7 &&
            formData.prefecture.length > 0 &&
            formData.city.length > 0 &&
            formData.town.length > 0
        );
      });

    return () => subscription.unsubscribe();
  }, []);

  const handleInputChange = (field: keyof AddressForm, value: string) => {
    // 【郵便番号の入力制限】
    if (field === 'postalCode') {
      // 正規表現 /^\d{0,7}$/ の説明：
      // ^ = 文字列の開始
      // \d = 数字（0-9）
      // {0,7} = 0文字以上7文字以下
      // $ = 文字列の終了
      // 結果: 空文字または1〜7桁の数字のみ許可
      if (!/^\d{0,7}$/.test(value)) {
        // 不正な入力の場合、処理を中断して何もしない
        return;
      }
    }
    
    // 【改善されたIME制御】
    // 1. React stateは常に更新（文字が表示されるため）
    const updatedForm = { ...form, [field]: value };
    setForm(updatedForm);
    
    // 2. RxJSへの送信はIME入力中はスキップ
    if (!isComposing) {
      formSubject$.next(updatedForm);
    }
  };

  // 【IME制御関数】
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (field: keyof AddressForm, value: string) => {
    setIsComposing(false);
    
    // 確定時にRxJSに送信
    const updatedForm = { ...form, [field]: value };
    formSubject$.next(updatedForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      alert('住所が正常に入力されました！');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            住所入力フォーム
          </h1>
          <p className="text-gray-600">日本の住所を入力してください</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="postalCode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  郵便番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="postalCode"
                  value={form.postalCode}
                  onChange={(e) =>
                    handleInputChange('postalCode', e.target.value)
                  }
                  placeholder="例: 1234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={7}
                />
              </div>

              <div>
                <label
                  htmlFor="prefecture"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  都道府県 <span className="text-red-500">*</span>
                </label>
                <select
                  id="prefecture"
                  value={form.prefecture}
                  onChange={(e) =>
                    handleInputChange('prefecture', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">選択してください</option>
                  <option value="北海道">北海道</option>
                  <option value="青森県">青森県</option>
                  <option value="岩手県">岩手県</option>
                  <option value="宮城県">宮城県</option>
                  <option value="秋田県">秋田県</option>
                  <option value="山形県">山形県</option>
                  <option value="福島県">福島県</option>
                  <option value="茨城県">茨城県</option>
                  <option value="栃木県">栃木県</option>
                  <option value="群馬県">群馬県</option>
                  <option value="埼玉県">埼玉県</option>
                  <option value="千葉県">千葉県</option>
                  <option value="東京都">東京都</option>
                  <option value="神奈川県">神奈川県</option>
                  <option value="新潟県">新潟県</option>
                  <option value="富山県">富山県</option>
                  <option value="石川県">石川県</option>
                  <option value="福井県">福井県</option>
                  <option value="山梨県">山梨県</option>
                  <option value="長野県">長野県</option>
                  <option value="岐阜県">岐阜県</option>
                  <option value="静岡県">静岡県</option>
                  <option value="愛知県">愛知県</option>
                  <option value="三重県">三重県</option>
                  <option value="滋賀県">滋賀県</option>
                  <option value="京都府">京都府</option>
                  <option value="大阪府">大阪府</option>
                  <option value="兵庫県">兵庫県</option>
                  <option value="奈良県">奈良県</option>
                  <option value="和歌山県">和歌山県</option>
                  <option value="鳥取県">鳥取県</option>
                  <option value="島根県">島根県</option>
                  <option value="岡山県">岡山県</option>
                  <option value="広島県">広島県</option>
                  <option value="山口県">山口県</option>
                  <option value="徳島県">徳島県</option>
                  <option value="香川県">香川県</option>
                  <option value="愛媛県">愛媛県</option>
                  <option value="高知県">高知県</option>
                  <option value="福岡県">福岡県</option>
                  <option value="佐賀県">佐賀県</option>
                  <option value="長崎県">長崎県</option>
                  <option value="熊本県">熊本県</option>
                  <option value="大分県">大分県</option>
                  <option value="宮崎県">宮崎県</option>
                  <option value="鹿児島県">鹿児島県</option>
                  <option value="沖縄県">沖縄県</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  市区町村 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="city"
                  value={form.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={(e) => handleCompositionEnd('city', (e.target as HTMLInputElement).value)}
                  placeholder="例: 新宿区"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="town"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  町域 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="town"
                  value={form.town}
                  onChange={(e) => handleInputChange('town', e.target.value)}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={(e) => handleCompositionEnd('town', (e.target as HTMLInputElement).value)}
                  placeholder="例: 西新宿"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="building"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  建物名・部屋番号
                </label>
                <input
                  type="text"
                  id="building"
                  value={form.building}
                  onChange={(e) =>
                    handleInputChange('building', e.target.value)
                  }
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={(e) => handleCompositionEnd('building', (e.target as HTMLInputElement).value)}
                  placeholder="例: 新宿ビル 101号室"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={!isValid}
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                  isValid
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                住所を登録
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            入力内容プレビュー
          </h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>〒{form.postalCode || '-------'}</p>
            <p>
              {form.prefecture || '都道府県'} {form.city || '市区町村'}{' '}
              {form.town || '町域'}
            </p>
            {form.building && <p>{form.building}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
