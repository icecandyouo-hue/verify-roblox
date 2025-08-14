import React, { useState } from 'react';
import { Check, Upload, User, Target, Home, AlertCircle, CheckCircle, Clipboard, Copy } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface VerificationData {
  playerName: string;
  gameScreenshot: File | null;
  robloxScreenshot: File | null;
}

interface VerificationResult {
  step1Valid: boolean;
  step2Valid: boolean;
  step2KillCount?: number;
  step2PlayerFound?: boolean;
  step3Valid: boolean;
  step3NameMatch?: boolean;
  overallValid: boolean;
}

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<VerificationData>({
    playerName: '',
    gameScreenshot: null,
    robloxScreenshot: null,
  });
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleFileUpload = (field: 'gameScreenshot' | 'robloxScreenshot') => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setData(prev => ({ ...prev, [field]: file }));
  };

  const handlePaste = (field: 'gameScreenshot' | 'robloxScreenshot') => async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const file = new File([blob], `pasted-image.${type.split('/')[1]}`, { type });
            setData(prev => ({ ...prev, [field]: file }));
            return;
          }
        }
      }
      alert('剪貼簿中沒有找到圖片');
    } catch (err) {
      console.error('無法讀取剪貼簿:', err);
      alert('無法讀取剪貼簿，請確保已允許剪貼簿權限');
    }
  };

  const handleDrop = (field: 'gameScreenshot' | 'robloxScreenshot') => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    if (imageFile) {
      setData(prev => ({ ...prev, [field]: imageFile }));
    }
  };

  const handleDragOver = (field: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(field);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const processStep2 = async (file: File): Promise<{ killCount: number; playerFound: boolean }> => {
    try {
      // 使用 Tesseract.js 進行 OCR 文字識別
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => console.log(m) // 可選：顯示處理進度
      });
      
      console.log('OCR 識別結果:', text);
      
      // 清理文字，移除多餘的空白和換行
      const cleanText = text.replace(/\s+/g, ' ').trim();
      
      // 尋找玩家名稱
      const playerFound = cleanText.toLowerCase().includes(data.playerName.toLowerCase());
      
      // 提取所有數字（3位數以上）
      const numbers = cleanText.match(/\d{3,}/g);
      let killCount = 0;
      
      if (numbers && numbers.length > 0) {
        // 如果有多個數字，取最大的那個（通常是總擊殺數）
        killCount = Math.max(...numbers.map(num => parseInt(num, 10)));
      }
      
      console.log('找到的數字:', numbers);
      console.log('最終擊殺數:', killCount);
      console.log('是否找到玩家名稱:', playerFound);
      
      return { killCount, playerFound };
      
    } catch (error) {
      console.error('OCR 處理錯誤:', error);
      // 如果 OCR 失敗，返回預設值
      return { killCount: 0, playerFound: false };
    }
  };

  const processStep3 = async (file: File): Promise<{ nameMatch: boolean }> => {
    try {
      // 使用 Tesseract.js 進行 OCR 文字識別
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => console.log(m)
      });
      
      console.log('Roblox 頁面 OCR 結果:', text);
      
      // 檢查是否包含玩家名稱
      const nameMatch = text.toLowerCase().includes(data.playerName.toLowerCase());
      
      console.log('用戶名匹配結果:', nameMatch);
      
      return { nameMatch };
      
    } catch (error) {
      console.error('Roblox 頁面 OCR 處理錯誤:', error);
      return { nameMatch: false };
    }
  };

  const handleSubmit = async () => {
    if (!data.playerName || !data.gameScreenshot || !data.robloxScreenshot) {
      return;
    }

    setIsProcessing(true);

    try {
      // 步驟 1：檢查玩家名字
      const step1Valid = data.playerName.trim().length > 0;

      // 步驟 2：處理遊戲截圖
      const step2Data = await processStep2(data.gameScreenshot);
      const step2Valid = step2Data.killCount >= 3000 && step2Data.playerFound;

      // 步驟 3：處理 Roblox 截圖
      const step3Data = await processStep3(data.robloxScreenshot);
      const step3Valid = step3Data.nameMatch;

      const verificationResult: VerificationResult = {
        step1Valid,
        step2Valid,
        step2KillCount: step2Data.killCount,
        step2PlayerFound: step2Data.playerFound,
        step3Valid,
        step3NameMatch: step3Data.nameMatch,
        overallValid: step1Valid && step2Valid && step3Valid,
      };

      setResult(verificationResult);
      setCurrentStep(4);
    } catch (error) {
      console.error('驗證過程中發生錯誤:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setData({ playerName: '', gameScreenshot: null, robloxScreenshot: null });
    setResult(null);
    setIsProcessing(false);
  };

  const copyVerificationScreenshot = async () => {
    if (!result) return;
    
    setIsCapturing(true);
    
    try {
      // 等待一小段時間確保 UI 更新完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const resultElement = document.getElementById('verification-result');
      if (!resultElement) {
        throw new Error('找不到驗證結果元素');
      }

      // 動態導入 html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      // 生成截圖
      const canvas = await html2canvas(resultElement, {
        backgroundColor: '#ffffff',
        scale: 2, // 提高解析度
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: resultElement.scrollWidth,
        height: resultElement.scrollHeight,
      });
      
      // 將 canvas 轉換為 blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('無法生成截圖');
        }
        
        try {
          // 複製到剪貼簿
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ]);
          
          setCopySuccess('screenshot');
          setTimeout(() => setCopySuccess(null), 3000);
        } catch (clipboardError) {
          console.error('複製到剪貼簿失敗:', clipboardError);
          
          // 如果剪貼簿失敗，提供下載選項
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `驗證結果_${data.playerName}_${new Date().toISOString().slice(0, 10)}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          setCopySuccess('download');
          setTimeout(() => setCopySuccess(null), 3000);
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('截圖失敗:', error);
      alert('截圖失敗，請稍後再試');
    } finally {
      setIsCapturing(false);
    }
  };


  const getStepIcon = (step: number) => {
    if (step === 1) return <User className="w-6 h-6" />;
    if (step === 2) return <Target className="w-6 h-6" />;
    if (step === 3) return <Home className="w-6 h-6" />;
    return <CheckCircle className="w-6 h-6" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Roblox 玩家驗證系統</h1>
            <p className="text-lg text-gray-600">自動化驗證流程 - 擊殺數需達3000以上</p>
          </div>

          {/* 進度條 */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      step <= currentStep
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {getStepIcon(step)}
                  </div>
                  {step < 4 && (
                    <div
                      className={`w-16 h-1 mx-2 ${
                        step < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>玩家名字</span>
              <span>遊戲截圖</span>
              <span>Roblox 截圖</span>
              <span>驗證結果</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* 步驟 1: 玩家名字 */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2">步驟 1: 輸入玩家名字</h2>
                  <p className="text-gray-600">請輸入您的 Roblox 玩家名稱</p>
                </div>
                <div className="max-w-md mx-auto">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Roblox 玩家名稱
                  </label>
                  <input
                    type="text"
                    value={data.playerName}
                    onChange={(e) => setData(prev => ({ ...prev, playerName: e.target.value }))}
                    placeholder="請打出遊戲內顯示的名子"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    
                  </p>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => data.playerName.trim() && setCurrentStep(2)}
                    disabled={!data.playerName.trim()}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    下一步
                  </button>
                </div>
              </div>
            )}

            {/* 步驟 2: 遊戲截圖 */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2">步驟 2: 上傳遊戲擊殺截圖</h2>
                  <p className="text-gray-600">請上傳顯示擊殺數的遊戲截圖（需包含玩家名稱 "{data.playerName}"）</p>
                </div>
                <div className="max-w-md mx-auto">
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragOver === 'gameScreenshot' 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-300 hover:border-indigo-400'
                    }`}
                    onDrop={handleDrop('gameScreenshot')}
                    onDragOver={handleDragOver('gameScreenshot')}
                    onDragLeave={handleDragLeave}
                  >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload('gameScreenshot')}
                      className="hidden"
                      id="gameScreenshot"
                    />
                    <label htmlFor="gameScreenshot" className="cursor-pointer">
                      <span className="text-indigo-600 font-medium">點擊選擇圖片</span>
                      <span className="text-gray-500"> 或拖拽圖片到這裡</span>
                    </label>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handlePaste('gameScreenshot')}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                      >
                        <Clipboard className="w-4 h-4" />
                        <span>從剪貼簿貼上</span>
                      </button>
                    </div>
                    {data.gameScreenshot && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ 已選擇: {data.gameScreenshot.name}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">截圖要求：</p>
                        <ul className="mt-1 space-y-1">
                          <li>• 必須顯示玩家名稱 "{data.playerName}" 在左側</li>
                          <li>• 必須清楚顯示總擊殺數（需≥3000）</li>
                          <li>• 格式如：玩家名稱 - 月殺數 - 總擊殺數</li>
                          <li>• 圖片清晰易讀</li>
                        </ul>
                        <div className="mt-3">
                          <p className="font-medium mb-2">參考示例：</p>
                          <div className="bg-gray-800 text-white p-3 rounded text-xs font-mono">
                            <div className="flex justify-between items-center">
                              <span>Aeris</span>
                              <span>998</span>
                              <span>10306</span>
                            </div>
                          </div>
                          <p className="text-xs mt-1 text-yellow-700">
                            ↑ 左側：玩家名稱，中間：月殺數，右側：總擊殺數（這個數字需≥3000）
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all font-medium"
                  >
                    上一步
                  </button>
                  <button
                    onClick={() => data.gameScreenshot && setCurrentStep(3)}
                    disabled={!data.gameScreenshot}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    下一步
                  </button>
                </div>
              </div>
            )}

            {/* 步驟 3: Roblox 截圖 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2">步驟 3: 上傳 Roblox 主頁截圖</h2>
                  <p className="text-gray-600">請上傳 Roblox 主頁截圖，確認右上角用戶名為 "{data.playerName}"</p>
                </div>
                <div className="max-w-md mx-auto">
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragOver === 'robloxScreenshot' 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-300 hover:border-indigo-400'
                    }`}
                    onDrop={handleDrop('robloxScreenshot')}
                    onDragOver={handleDragOver('robloxScreenshot')}
                    onDragLeave={handleDragLeave}
                  >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload('robloxScreenshot')}
                      className="hidden"
                      id="robloxScreenshot"
                    />
                    <label htmlFor="robloxScreenshot" className="cursor-pointer">
                      <span className="text-indigo-600 font-medium">點擊選擇圖片</span>
                      <span className="text-gray-500"> 或拖拽圖片到這裡</span>
                    </label>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handlePaste('robloxScreenshot')}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                      >
                        <Clipboard className="w-4 h-4" />
                        <span>從剪貼簿貼上</span>
                      </button>
                    </div>
                    {data.robloxScreenshot && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ 已選擇: {data.robloxScreenshot.name}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">截圖要求：</p>
                        <ul className="mt-1 space-y-1">
                          <li>• 必須是 Roblox 官方網站主頁</li>
                          <li>• 右上角用戶名必須顯示 "{data.playerName}"</li>
                          <li>• 確保是已登入狀態</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all font-medium"
                  >
                    上一步
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!data.robloxScreenshot || isProcessing}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    {isProcessing ? '正在驗證...' : '開始驗證'}
                  </button>
                </div>
              </div>
            )}

            {/* 步驟 4: 結果 */}
            {currentStep === 4 && result && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2">驗證結果</h2>
                  <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full ${
                    result.overallValid 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.overallValid ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="font-medium">
                      {result.overallValid ? '驗證通過' : '驗證失敗'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* 步驟 1 結果 */}
                  <div className={`p-4 rounded-lg border-l-4 ${
                    result.step1Valid 
                      ? 'bg-green-50 border-green-400' 
                      : 'bg-red-50 border-red-400'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {result.step1Valid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <h3 className="font-medium">步驟 1: 玩家名稱</h3>
                    </div>
                    <p className="text-sm mt-1">
                      玩家名稱: {data.playerName}
                    </p>
                  </div>

                  {/* 步驟 2 結果 */}
                  <div className={`p-4 rounded-lg border-l-4 ${
                    result.step2Valid 
                      ? 'bg-green-50 border-green-400' 
                      : 'bg-red-50 border-red-400'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {result.step2Valid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <h3 className="font-medium">步驟 2: 遊戲擊殺截圖</h3>
                    </div>
                    <div className="text-sm mt-1 space-y-1">
                      <p>檢測到的擊殺數: {result.step2KillCount?.toLocaleString()}</p>
                      <p>是否找到玩家名稱: {result.step2PlayerFound ? '✓ 是' : '✗ 否'}</p>
                      {!result.step2PlayerFound && (
                        <p className="text-red-600 text-xs">
                          * 請確保截圖中清楚顯示玩家名稱 "{data.playerName}"，文字要清晰可讀
                        </p>
                      )}
                      {result.step2KillCount === 0 && (
                        <p className="text-red-600 text-xs">
                          * 無法識別擊殺數，請確保截圖清晰且數字可讀
                        </p>
                      )}
                      <p className={result.step2KillCount && result.step2KillCount >= 3000 ? 'text-green-600' : 'text-red-600'}>
                        擊殺數要求: {result.step2KillCount && result.step2KillCount >= 3000 ? '✓ 達標' : '✗ 未達標（需≥3000）'}
                      </p>
                    </div>
                  </div>

                  {/* 步驟 3 結果 */}
                  <div className={`p-4 rounded-lg border-l-4 ${
                    result.step3Valid 
                      ? 'bg-green-50 border-green-400' 
                      : 'bg-red-50 border-red-400'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {result.step3Valid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <h3 className="font-medium">步驟 3: Roblox 主頁截圖</h3>
                    </div>
                    <p className="text-sm mt-1">
                      用戶名匹配: {result.step3NameMatch ? '✓ 匹配' : '✗ 不匹配'}
                    </p>
                  </div>
                </div>

                {result.overallValid && (
                  <div id="verification-result" className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <div className="text-center">
                      <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-green-800 mb-2">恭喜！驗證通過</h3>
                      <p className="text-green-700">
                        玩家 "{data.playerName}" 已成功通過所有驗證步驟。
                      </p>
                    </div>
                    
                    {/* 詳細驗證信息 */}
                    <div className="mt-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="bg-white p-4 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium">步驟 1: 玩家名稱</span>
                          </div>
                          <p>玩家名稱: {data.playerName}</p>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium">步驟 2: 遊戲擊殺截圖</span>
                          </div>
                          <p>檢測到的擊殺數: {result.step2KillCount?.toLocaleString()}</p>
                          <p>是否找到玩家名稱: ✓ 是</p>
                          <p>擊殺數要求: ✓ 達標</p>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium">步驟 3: Roblox 主頁截圖</span>
                          </div>
                          <p>用戶名匹配: ✓ 匹配</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!result.overallValid && (
                  <div id="verification-result" className="bg-red-50 p-6 rounded-lg border border-red-200">
                    <div className="text-center">
                      <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-red-800 mb-2">驗證未通過</h3>
                      <p className="text-red-700 mb-4">
                        請檢查上述失敗項目，修正後重新驗證，若一直失敗可改為手動驗證。
                      </p>
                    </div>
                  </div>
                )}

                {/* 複製功能區域 */}
                <div className="mt-6 space-y-4">
                  <h4 className="text-lg font-medium text-gray-800 text-center">複製給管理員</h4>
                  <div className="flex justify-center">
                    <button
                      onClick={copyVerificationScreenshot}
                      disabled={isCapturing}
                      className={`inline-flex items-center space-x-2 px-6 py-3 rounded-lg transition-all ${
                        copySuccess === 'screenshot' 
                          ? 'bg-green-600 text-white' 
                          : copySuccess === 'download'
                          ? 'bg-blue-600 text-white'
                          : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800'
                      } ${isCapturing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Copy className="w-5 h-5" />
                      <span>
                        {isCapturing ? '正在截圖...' : 
                         copySuccess === 'screenshot' ? '驗證結果已複製！' :
                         copySuccess === 'download' ? '已下載截圖！' : '複製驗證結果截圖'}
                      </span>
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    💡 複製截圖後可直接貼到 Discord 給管理員查看
                  </p>
                </div>

                <div className="flex justify-center mt-6">
                  <button
                    onClick={resetForm}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium"
                  >
                    重新驗證
                  </button>
                </div>
              </div>
            )}

            {/* 處理中的狀態 */}
            {isProcessing && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 text-center">
                  <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">正在驗證中...</h3>
                  <p className="text-gray-600">正在使用 OCR 技術分析您的截圖，請稍等...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;