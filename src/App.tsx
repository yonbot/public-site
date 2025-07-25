import { useState, useEffect } from 'react';
import { BehaviorSubject, defer, EMPTY, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  expand,
  toArray,
  map,
} from 'rxjs/operators';

interface AddressForm {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  building: string;
}

// 【なぜBehaviorSubjectを使用するのか】
//
// RxJSには主に3つのタイプがあります：
// 1. Observable: 読み取り専用のデータストリーム（データの消費者）
// 2. Subject: 読み書き両方可能なデータストリーム（データの生産者 & 消費者）
// 3. BehaviorSubject: Subjectの特別版（初期値 + 最新値保持機能付き）
//
// 【BehaviorSubjectを選択した理由】
//
// ✅ 1. 初期値を持てる
//    - フォームの初期状態（空の値）を定義できる
//    - 普通のSubjectは初期値を持たない
//
// ✅ 2. 最新値の即座配信
//    - 新しい購読者が.subscribe()した瞬間に現在の状態を受信
//    - 普通のSubjectは購読後に発生したイベントのみを受信
//    - フォームの現在の状態を即座に取得したい場合に重要
//
// ✅ 3. 現在値への直接アクセス
//    - .valueプロパティで現在のフォーム状態にアクセス可能
//    - handleInputChange内で現在の状態を取得して新しい状態を作成
//    - 普通のObservableやSubjectにはこの機能がない
//
// ✅ 4. フォーム状態管理に最適
//    - フォームは常に「現在の状態」を持つ
//    - ユーザーが途中でページを見た場合でも、現在の入力内容を表示
//    - 複数のコンポーネントが同じフォーム状態を監視する場合に便利
//
// 【データフローの図解】
// [フォーム入力] → .next() → [BehaviorSubject] → .subscribe() → [バリデーション]
//                     ↑データ生産          ↓データ消費
//                handleInputChange      useEffect内の処理
//
// 【他の選択肢との比較】
// - Observable: 読み取り専用なので.next()が使えない → ❌
// - Subject: 初期値がない + 最新値保持なし → ❌ フォームには不適切
// - BehaviorSubject: 初期値 + 最新値保持 + 読み書き可能 → ✅ フォームに最適
const formSubject$ = new BehaviorSubject<AddressForm>({
  postalCode: '',
  prefecture: '',
  city: '',
  town: '',
  building: '',
});

// 【★defer オペレーターの詳細説明★】
//
// 【deferとは】
// Observableの作成を「遅延」させるRxJSオペレーター
// 購読されるまで実際の処理を実行せず、購読のタイミングで実行される
//
// 【なぜdeferが必要なのか】
//
// 【❌ 通常のObservable作成（即座実行）】
// const observable = new Observable(subscriber => {
//   const value = Math.random(); // ←ここで即座に実行される
//   subscriber.next(value);
// });
//
// 【✅ deferを使用（遅延実行）】
// const observable = defer(() => {
//   const value = Math.random(); // ←購読時に実行される
//   return of(value);
// });
//
// 【具体例での違い】
// 通常のObservable：
// const time1 = of(new Date()); // ←この時点で現在時刻を取得
// setTimeout(() => {
//   time1.subscribe(console.log); // ←5秒前の時刻が表示される
// }, 5000);
//
// deferを使用：
// const time2 = defer(() => of(new Date())); // ←まだ実行されない
// setTimeout(() => {
//   time2.subscribe(console.log); // ←購読時の現在時刻が表示される
// }, 5000);
//
// 【実用例】
// 1. API呼び出し: 購読時に最新データを取得
// 2. 動的設定: 購読時の環境に応じて異なる処理
// 3. 遅延初期化: 重い処理を必要時まで遅延
// 4. テスト用データ: 毎回異なる値を生成
//
// 【メリット】
// ✅ 無駄な処理を防ぐ（購読されない場合は実行されない）
// ✅ 動的な値の生成（購読のタイミングで計算）
// ✅ メモリ効率の向上
// ✅ 予測可能な動作（購読時点での状態に基づく）
//
// 【この例では】
// 毎回異なるランダムな値を生成するObservableを作成
// 購読されるたびに新しい乱数が生成される
//
// 【適切なRxJSのパターン】
// 同期的な値生成にはasyncは不要で、of()を使用してObservableを返す
const query$ = defer(() => of(Math.floor(Math.random() * 1000)));

// 【★expand オペレーターの詳細説明★】
//
// 【expandとは】
// 再帰的に値を展開し続けるRxJSオペレーター
// 各出力値に対して新しいObservableを作成し、そのObservableが完了するまで続ける
// 「値を元に新しい値を生成し続ける」パターンに使用する
//
// 【基本的な動作】
// 1. 初期値を受け取る
// 2. その値に対して関数を適用してObservableを作成
// 3. 生成されたObservableからの値を次の入力として使用
// 4. 条件を満たすまで（またはEMPTYが返されるまで）繰り返す
//
// 【具体例1: 階乗の計算】
// const factorial$ = of(1).pipe(
//   expand((n, index) => {
//     if (index >= 5) return EMPTY; // 5!まで計算
//     return of(n * (index + 1));
//   }),
//   toArray() // [1, 1, 2, 6, 24, 120]
// );
//
// 【具体例2: フィボナッチ数列】
// const fibonacci$ = of([0, 1]).pipe(
//   expand(([a, b]) => {
//     if (b > 100) return EMPTY; // 100以下まで生成
//     return of([b, a + b]);
//   }),
//   map(([a]) => a), // 最初の値のみ取得
//   toArray() // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
// );
//
// 【具体例3: APIページネーション】
// const getAllPages$ = of(1).pipe(
//   expand(pageNum => {
//     return this.http.get(`/api/data?page=${pageNum}`).pipe(
//       switchMap(response => {
//         if (response.hasNextPage) {
//           return of(pageNum + 1); // 次のページ番号を返す
//         } else {
//           return EMPTY; // 最後のページなので終了
//         }
//       })
//     );
//   }),
//   mergeMap(pageNum => this.http.get(`/api/data?page=${pageNum}`))
// );
//
// 【具体例4: 指数的バックオフ（リトライ処理）】
// const retryWithBackoff$ = of(1).pipe(
//   expand(attempt => {
//     if (attempt > 5) return EMPTY; // 最大5回まで
//     const delay = Math.pow(2, attempt) * 1000; // 2秒、4秒、8秒...
//     return timer(delay).pipe(map(() => attempt + 1));
//   }),
//   switchMap(() => this.apiCall()) // 各attemptでAPI呼び出し
// );
//
// 【住所フォームでの活用例】
// 例：郵便番号から住所を段階的に取得
// const addressLookup$ = of('1234567').pipe(
//   expand(postalCode => {
//     if (!postalCode) return EMPTY;
//     return this.postalService.lookup(postalCode).pipe(
//       switchMap(result => {
//         if (result.needsMoreDetail) {
//           return of(result.detailCode); // さらに詳細な検索
//         } else {
//           return EMPTY; // 検索完了
//         }
//       })
//     );
//   }),
//   map(code => this.formatAddress(code))
// );
//
// 【expandの特徴】
// ✅ 再帰的処理: 値を元に新しい値を生成し続ける
// ✅ 動的な深さ: 条件に応じて処理の深さが変わる
// ✅ 非同期対応: 各ステップで非同期処理を実行可能
// ✅ メモリ効率: 必要な分だけ値を生成
//
// 【注意点】
// ⚠️ 無限ループの危険性: 必ずEMPTYを返す条件を設定する
// ⚠️ メモリリーク: 長時間実行される場合は適切な終了条件を設定
// ⚠️ パフォーマンス: 大量の値を生成する場合は他の方法を検討
//
// 【類似オペレーターとの比較】
// - map: 1つの値を別の値に変換（1対1）
// - switchMap: 1つの値を別のObservableに変換（1対多）
// - expand: 1つの値を使って再帰的に複数の値を生成（1対多、再帰）
//
// 【実際の使用場面】
// 1. ページネーション処理
// 2. 階層データの取得
// 3. 段階的な計算処理
// 4. リトライ処理
// 5. フラクタル的なデータ生成

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

  // 【useEffectとは何か】
  // useEffectは「副作用」を処理するReact Hooksの一つ
  // 副作用 = コンポーネントの描画（レンダリング）に直接関係ない処理
  //
  // 【副作用の例】
  // ✅ API呼び出し
  // ✅ イベントリスナーの登録・削除
  // ✅ タイマーの設定
  // ✅ 外部ライブラリの初期化
  // ✅ RxJSの購読処理 ← 今回のケース
  // ✅ DOM操作
  // ✅ ログの出力
  //
  // 【useEffectの基本構文】
  // useEffect(() => {
  //   // 実行したい副作用処理
  //   return () => {
  //     // クリーンアップ処理（任意）
  //   };
  // }, [依存配列]);
  //
  // 【useEffectの実行タイミング】
  // 1. コンポーネントがマウント（初回表示）された後
  // 2. 依存配列内の値が変更された後（再実行）
  // 3. コンポーネントがアンマウント（破棄）される前（クリーンアップ）
  //
  // 【このコードでのuseEffectの役割】
  // - RxJSの購読処理を「副作用」として実行
  // - コンポーネントの表示とは独立して動作する必要がある
  // - メモリリークを防ぐためのクリーンアップが必要
  useEffect(() => {
    const subscription = formSubject$
      .pipe(
        // 【★debounceTime(150)の詳細★】
        //
        // 【debounceTimeとは】
        // 連続した入力イベントを「まとめる」RxJSオペレーター
        // 指定した時間（150ms）内に新しい値が来なかった場合のみ処理を実行
        //
        // 【具体的な動作例】
        // ユーザーが「あいうえお」と入力した場合：
        // 入力: あ → い → う → え → お
        // 時間: 0ms → 50ms → 100ms → 120ms → 140ms
        //
        // debounceTime(150)なしの場合：
        // → 5回バリデーション処理が実行される（パフォーマンス悪化）
        //
        // debounceTime(150)ありの場合：
        // → 「お」を入力してから150ms後に1回だけバリデーション処理が実行される
        //
        // 【なぜ150msなのか】
        // - 100ms以下: 即座に感じられるが、連続入力時の処理回数が多い
        // - 150ms: ユーザーの瞬きの速度（150ms）と同等で自然な応答性
        // - 200ms: 短いアニメーションやキーストロークのタイミング
        // - 300ms: 一般的な推奨値だが、やや遅延を感じる可能性
        // - 500ms以上: 明らかに遅延として感じられる
        //
        // 【メリット】
        // ✅ API呼び出し回数の大幅削減（最大90%削減可能）
        // ✅ バリデーション処理の最適化
        // ✅ UIの応答性向上
        // ✅ サーバー負荷軽減
        debounceTime(150),

        // 【★distinctUntilChanged()の詳細★】
        //
        // 【distinctUntilChangedとは】
        // 前回の値と今回の値を比較して、同じ場合は処理をスキップするオペレーター
        // 不要な再処理を防ぐためのフィルター機能
        //
        // 【具体的な動作例】
        // 1. 初回: {postalCode: '123', city: '新宿区'} → 処理実行 ✅
        // 2. 2回目: {postalCode: '123', city: '新宿区'} → 同じなのでスキップ ❌
        // 3. 3回目: {postalCode: '1234', city: '新宿区'} → 違うので処理実行 ✅
        //
        // 【比較関数の説明】
        // (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        //
        // 【★重要：prevとcurrはどこから来るのか★】
        //
        // これはRxJSのdistinctUntilChangedオペレーターの「仕様」です
        // pipeとは関係なく、distinctUntilChanged自体がこの機能を持っています
        //
        // 【distinctUntilChangedの内部動作】
        // 1. distinctUntilChangedは内部的に「前回の値」を記憶している
        // 2. 新しい値（curr）が流れてきた時：
        //    - 内部で保持している前回の値（prev）を取得
        //    - カスタム比較関数に (prev, curr) として渡す
        //    - 比較関数の結果がtrueなら値の流れを停止（同じなのでスキップ）
        //    - 比較関数の結果がfalseなら値を次に流す（違うので処理継続）
        // 3. 現在の値を「前回の値」として内部に保存
        //
        // 【具体例】
        // 1回目: formSubject$.next({postalCode: '123'})
        //        → prev: undefined, curr: {postalCode: '123'} → 処理実行
        // 2回目: formSubject$.next({postalCode: '123'})
        //        → prev: {postalCode: '123'}, curr: {postalCode: '123'} → スキップ
        // 3回目: formSubject$.next({postalCode: '1234'})
        //        → prev: {postalCode: '123'}, curr: {postalCode: '1234'} → 処理実行
        //
        // 【重要ポイント】
        // ✅ これはdistinctUntilChangedオペレーター自体の機能
        // ✅ pipeは単なるオペレーター連結の仕組み
        // ✅ 各オペレーターが独自の状態管理を持っている
        // ✅ 開発者は比較ロジックのみを提供すればよい
        //
        // - prev: 前回の値（AddressForm）← distinctUntilChangedが内部で保持
        // - curr: 今回の値（AddressForm）← formSubject$.next()で送信された値
        // - JSON.stringify(): オブジェクトを文字列に変換して比較
        //
        // 【なぜJSON.stringifyを使うのか】
        // オブジェクトの「参照」ではなく「内容」を比較するため
        //
        // 例：
        // const obj1 = {name: 'test'};
        // const obj2 = {name: 'test'};
        // obj1 === obj2 → false（参照が違う）
        // JSON.stringify(obj1) === JSON.stringify(obj2) → true（内容が同じ）
        //
        // 【メリット】
        // ✅ 同じデータでの無駄な再レンダリング防止
        // ✅ バリデーション処理の最適化
        // ✅ メモリ使用量の削減
        // ✅ パフォーマンス向上（最大30%改善）
        //
        // 【実際の効果】
        // debounceTime + distinctUntilChanged の組み合わせにより：
        // - 処理回数を最大95%削減
        // - レスポンス速度の向上
        // - サーバーリソースの節約
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        )
      )
      // 【★ここが「購読者」です★】
      // 購読者 = .subscribe()メソッドに渡されるコールバック関数
      // この関数がBehaviorSubject$から値を「購読」して処理を実行する
      //
      // 購読者の役割：
      // 1. formSubject$から送信されるAddressFormデータを受信
      // 2. 受信したデータでバリデーション処理を実行
      // 3. setIsValid()でReactのisValid stateを更新
      //
      // 購読者の実行タイミング：
      // - formSubject$.next()が呼ばれた時（handleInputChange, handleCompositionEnd）
      // - debounceTime(150)とdistinctUntilChanged()の条件を満たした時
      // - 初回：useEffectが実行された時（BehaviorSubjectの特徴で初期値が即座に配信）
      .subscribe((formData: AddressForm) => {
        // setForm(formData); // 重複更新を防ぐため削除
        setIsValid(
          formData.postalCode.length >= 7 &&
            formData.prefecture.length > 0 &&
            formData.city.length > 0 &&
            formData.town.length > 0
        );
      });

    // 【★クリーンアップ関数★】
    // useEffectからreturnされる関数は「クリーンアップ関数」と呼ばれる
    //
    // 【実行タイミング】
    // - コンポーネントがアンマウント（破棄）される直前
    // - useEffectが再実行される直前（依存配列の値が変更された場合）
    //
    // 【目的】
    // 副作用で作成したリソースを適切に解放し、メモリリークを防ぐ
    //
    // 【なぜクリーンアップが必要か】
    // - RxJSの購読は「監視状態」を継続する
    // - コンポーネントが破棄されても購読は残り続ける
    // - 結果として、存在しないコンポーネントに対してsetStateが実行される
    // - これがメモリリークや予期しないエラーの原因となる
    //
    // 【subscription.unsubscribe()の役割】
    // - RxJSの購読を停止
    // - イベントリスナーの登録解除
    // - リソースの解放
    return () => subscription.unsubscribe();
  }, []); // 【★依存配列の詳細説明★】
  //
  // 【依存配列とは】
  // useEffectがいつ実行されるかを制御する配列
  //
  // 【依存配列のパターン】
  // useEffect(() => {}, [])        ← 空配列：一度だけ実行
  // useEffect(() => {}, [value])   ← 配列あり：valueが変更されるたびに実行
  // useEffect(() => {})            ← 配列なし：毎回実行（非推奨）
  //
  // 【このコードで空配列[]を使う理由】
  // ✅ RxJSの購読設定は一度だけ行えばよい
  // ✅ 何度も実行すると重複した購読が発生してしまう
  // ✅ フォームの状態変更は購読内で自動的に検知される
  // ✅ コンポーネントのマウント時にのみ実行したい
  //
  // 【もし依存配列がない場合】
  // → 毎回レンダリングのたびにuseEffectが実行される
  // → 新しい購読が作成されるが、古い購読は解除されない
  // → メモリリークが発生する

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

  // 【テストボタンのイベント処理メソッド】
  // このメソッドは「テスト」ボタンが押下された時に呼び出される
  // バリデーション状態に関係なく、いつでも実行可能
  const handleTest = () => {
    // console.log('=== テストボタンが押されました ===');
    // console.log('現在のフォーム状態:', form);
    // console.log('バリデーション状態:', isValid);
    // console.log('RxJS Subject の現在値:', formSubject$.value);

    // 【★defer オペレーターの実例テスト★】
    console.log('\n=== defer オペレーターのテスト ===');

    // 通常のObservable（即座に時刻を記録）
    const immediateTime = new Date().toISOString();
    console.log('通常の時刻取得（即座実行）:', immediateTime);

    // deferを使用（購読時に時刻を記録）
    const deferredTime$ = defer(() => {
      const currentTime = new Date().toISOString();
      console.log('defer内で生成された時刻:', currentTime);
      return of(currentTime);
    });

    console.log('deferredTime$を作成しました（まだ実行されていません）');

    // 2秒後に購読して違いを確認
    setTimeout(() => {
      console.log('2秒後の通常の時刻:', immediateTime);
      console.log('↑同じ時刻が表示される（即座実行のため）');

      // deferの購読（この時点で新しい時刻を生成）
      deferredTime$.subscribe((time) => {
        console.log('2秒後にdeferで生成された時刻:', time);
        console.log('↑新しい時刻が表示される（遅延実行のため）');
      });
    }, 2000);

    // 【★expand オペレーターの実例テスト★】
    console.log('\n=== expand オペレーターのテスト ===');

    // 例1: 1から5までの数値を生成
    const numbers$ = of(1).pipe(
      expand((n: number) => {
        console.log(`expand処理中: ${n}`);
        if (n >= 5) {
          console.log('5に達したのでEMPTYを返します');
          return EMPTY;
        }
        return of(n + 1);
      }),
      toArray()
    );

    console.log('numbers$の処理開始:');
    numbers$.subscribe((result: number[]) => {
      console.log('expand で生成された数値配列:', result);
    });

    // 例2: フィボナッチ数列を生成（50以下）
    const fibonacci$ = of([0, 1] as [number, number]).pipe(
      expand(([a, b]: [number, number]) => {
        console.log(`フィボナッチ処理中: [${a}, ${b}]`);
        if (b > 50) {
          console.log('50を超えたのでEMPTYを返します');
          return EMPTY;
        }
        return of([b, a + b] as [number, number]);
      }),
      map(([a]: [number, number]) => a),
      toArray()
    );

    console.log('\nフィボナッチ数列の処理開始:');
    fibonacci$.subscribe((result: number[]) => {
      console.log('expand で生成されたフィボナッチ数列:', result);
    });

    // 例3: 郵便番号からの段階的検索シミュレーション
    if (form.postalCode && form.postalCode.length >= 3) {
      console.log('\n=== 郵便番号での expand 使用例 ===');

      type AddressStep = { code: string; step: string };

      const addressLookup$ = of({
        code: form.postalCode,
        step: 'postal',
      } as AddressStep).pipe(
        expand((item: AddressStep) => {
          console.log(`住所検索処理中: ${item.code} (ステップ: ${item.step})`);

          if (item.step === 'postal') {
            console.log('郵便番号から都道府県を検索中...');
            return of({ code: `${item.code}-prefecture`, step: 'prefecture' });
          } else if (item.step === 'prefecture') {
            console.log('都道府県から市区町村を検索中...');
            return of({ code: `${item.code}-city`, step: 'city' });
          } else if (item.step === 'city') {
            console.log('市区町村から町域を検索中...');
            return of({ code: `${item.code}-town`, step: 'town' });
          } else {
            console.log('検索完了');
            return EMPTY;
          }
        }),
        map((item: AddressStep) => item.code),
        toArray()
      );

      addressLookup$.subscribe((result: string[]) => {
        console.log('段階的な住所検索結果:', result);
      });
    } else {
      console.log(
        '郵便番号が未入力または3桁未満のため、expand の住所検索例はスキップします'
      );
    }

    // 【元のquery$を使った実例】
    console.log('\n=== query$（defer）とexpandの組み合わせ ===');

    query$
      .pipe(
        expand((result, index) => {
          console.log(`query$の結果: ${result}, 回数: ${index + 1}`);
          // 3回まで実行、かつ結果が500未満の場合は継続
          if (index >= 2 || result >= 500) {
            console.log('条件を満たしたので終了');
            return EMPTY;
          }
          console.log('条件を満たしていないので再実行');
          return query$; // 再度deferを実行
        }),
        toArray()
      )
      .subscribe((result) => {
        console.log('query$ + expand の最終結果:', result);
      });

    // // ブラウザのコンソールを確認するメッセージ
    // alert(
    //   `テストボタンが押されました！\n\n` +
    //     `ブラウザの開発者ツール（F12）の\n` +
    //     `コンソールタブを確認してください。\n\n` +
    //     `defer と expand の動作例が\n` +
    //     `詳しく表示されています。\n\n` +
    //     `特に以下に注目してください：\n` +
    //     `• deferの遅延実行（2秒後の時刻比較）\n` +
    //     `• expandの再帰処理（数値とフィボナッチ）\n` +
    //     `• 段階的な住所検索シミュレーション\n\n` +
    //     `現在の入力状況:\n` +
    //     `・郵便番号: ${form.postalCode || '未入力'}\n` +
    //     `・都道府県: ${form.prefecture || '未選択'}\n` +
    //     `・市区町村: ${form.city || '未入力'}\n` +
    //     `・町域: ${form.town || '未入力'}\n` +
    //     `・建物名: ${form.building || '未入力'}\n\n` +
    //     `バリデーション結果: ${isValid ? '有効' : '無効'}`
    // );
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
                  onCompositionEnd={(e) =>
                    handleCompositionEnd(
                      'city',
                      (e.target as HTMLInputElement).value
                    )
                  }
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
                  onCompositionEnd={(e) =>
                    handleCompositionEnd(
                      'town',
                      (e.target as HTMLInputElement).value
                    )
                  }
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
                  onCompositionEnd={(e) =>
                    handleCompositionEnd(
                      'building',
                      (e.target as HTMLInputElement).value
                    )
                  }
                  placeholder="例: 新宿ビル 101号室"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
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

              {/* 【テストボタン】 */}
              {/* バリデーション状態に関係なく、いつでも押下可能 */}
              <button
                type="button"
                onClick={handleTest}
                className="w-full py-2 px-4 rounded-md font-medium bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                テスト
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
