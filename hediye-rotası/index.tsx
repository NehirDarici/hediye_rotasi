
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- HELPER DATA ---
const professions = ["Öğrenci", "Öğretmen", "Yazılımcı", "Doktor", "Mühendis", "Avukat", "Sanatçı", "Esnaf", "Yönetici", "Pazarlamacı", "İnsan Kaynakları", "Finansçı", "Mimar", "Tasarımcı", "Girişimci", "Atlet", "Serbest Çalışan", "Emekli", "Diğer"];
const interestsList = ["Kitap", "Film/Dizi", "Müzik", "Spor", "Kahve / Çay", "Yoga / Meditasyon", "Teknoloji / Oyun", "Seyahat", "Ev Dekorasyonu", "Hayvanlar", "Moda", "Tarih", "Otomotiv", "Yemek Yapma", "Gurme Lezzetler", "Bahçe İşleri", "Fotoğrafçılık", "Doğa Yürüyüşü", "Masa Oyunları", "Sanat", "Bilim & Keşif", "Koleksiyonculuk", "El Sanatları / DIY", "Spiritüellik", "Kişisel Gelişim", "Ekolojik Yaşam"];
const stylesList = ["Eğlenceli", "Minimalist", "Nostaljik", "Pratik", "Sürprizli", "Lüks", "Bohem", "Spor/Gündelik", "Klasik"];
const giftTypeOptions = ['Fiziksel ürün', 'Dijital ürün', 'Deneyim', 'Hediye Kutusu'];
const occasionOptions = ['Doğum Günü', 'Yılbaşı', 'Yıl Dönümü', 'Kutlama', 'İçimden Geldi'];
const familyMemberOptions = ['Anne', 'Baba', 'Kız Kardeş', 'Erkek Kardeş', 'Eş', 'Çocuk'];
const initialFormState = {
    gender: '', age: '', profession: '', recipient: '', occasion: '', familyMember: '',
    interests: [], color: '', styles: [], giftType: [],
    budget: {min: '', max: ''},
    notes: '',
    city: '', date: '',
    image: { data: null as string | null, mimeType: null as string | null }
};

// --- HELPER FUNCTIONS & PROMPT BUILDERS ---

/**
 * Safely parses a JSON string that might be embedded in a larger text.
 * @param {string} text The text containing the JSON.
 * @returns {any} The parsed JSON object or array.
 * @throws {Error} If valid JSON cannot be found or parsed.
 */
const parseJsonSafely = (text) => {
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
        throw new Error("Geçerli JSON dizisi bulunamadı.");
    }
    const jsonString = text.substring(jsonStart, jsonEnd + 1);
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("JSON Parse Error:", e, "Original string:", jsonString);
        throw new Error("Yapay zekadan gelen yanıt beklenmedik bir formatta.");
    }
};


/**
 * Builds the prompt for the gift suggestion API call.
 * @param {typeof initialFormState} formData The user's form data.
 * @returns {string} The complete prompt for the AI.
 */
const buildGiftPrompt = (formData) => {
    const budgetInfo = (formData.budget.min && formData.budget.max) ? `arasında bir bütçe ile ${formData.budget.min} TL - ${formData.budget.max} TL` : (formData.budget.min ? `${formData.budget.min} TL üzeri` : (formData.budget.max ? `${formData.budget.max} TL altı` : 'belirtilmemiş'));
    const imageAnalysisRequest = formData.image.data ? "Ayrıca, ekteki fotoğrafı analiz et. Fotoğraftaki kişinin veya ortamın tarzı, renkleri, objeleri ve genel atmosferi hediye seçimine ilham versin." : "";
    return `Bir hediye alıcısı için hediye önerileri oluştur. Alıcının özellikleri:\n- Kime: ${formData.recipient}${formData.recipient === 'Aile' && formData.familyMember ? ` (${formData.familyMember})` : ''}, Cinsiyet: ${formData.gender}, Yaş: ${formData.age}, Meslek: ${formData.profession || 'belirtilmemiş'}\n- Amaç: ${formData.occasion}\n- İlgi alanları: ${formData.interests.join(', ') || 'belirtilmemiş'}\n- Tarzı: ${formData.styles.join(', ') || 'belirtilmemiş'}\n- Renk tercihi: ${formData.color || 'belirtilmemiş'}\n- Hediye tipi: ${formData.giftType.join(', ') || 'belirtilmemiş'}\n- Bütçe: ${budgetInfo}\n- Ek notlar: ${formData.notes || 'yok'}.\n${imageAnalysisRequest}\n\nLütfen bu bilgilere dayanarak 5 adet yaratıcı ve kişiye özel hediye önerisi sun. Her öneri için:\n1. Hediyenin adını ("giftName").\n2. Hediyeyi kısaca tanıtan bir açıklama ("description").\n3. Bu kişinin bu hediyeyi neden seveceğine dair kişisel bir sebep ("reason").\n4. Hediyenin kategorisini ("category", örn: "Elektronik", "Moda", "Kitap", "Deneyim").\n5. Kullanıcının belirttiği bütçeye uygun, tahmini bir fiyat aralığı ("priceRange", örn: '800-1200 TL').\n6. Hediyeyi bulmak için bir görsel arama sorgusu ("imageQuery", İngilizce ve etkili olmalı).\n7. Önerilen hediyeyi doğrudan aratacak şekilde Trendyol, Amazon Türkiye ve Hepsiburada için tam URL'ler oluştur ("trendyolLink", "amazonLink", "hepsiburadaLink"). URL'ler "https://www.trendyol.com/sr?q=...", "https://www.amazon.com.tr/s?k=...", "https://www.hepsiburada.com/ara?q=..." formatında olmalı ve arama terimi URL-encode edilmelidir.`;
};


/**
 * Builds the prompt for the activity suggestion API call.
 * @param {typeof initialFormState} formData The user's form data.
 * @returns {string} The complete prompt for the AI.
 */
const buildActivityPrompt = (formData) => {
    const imageAnalysisRequest = formData.image.data ? "Ayrıca, ekteki fotoğrafı analiz et. Fotoğraftaki kişinin veya ortamın tarzı, renkleri, objeleri ve genel atmosferi aktivite seçimine ilham versin." : "";
    return `Sen unutulmaz deneyimler yaratan uzman bir etkinlik planlayıcısısın. Kullanıcı girdilerine dayanarak en az 5 kişiselleştirilmiş aktivite veya etkinlik önerisi oluştur. Belirtilen şehir ve tarih civarında gerçek, güncel konserler, tiyatro oyunları, atölyeler veya festivaller gibi etkinlikleri bulmak için Google Arama'yı kullan.\n\nKullanıcı Girdileri:\n- Kime: ${formData.recipient}${formData.recipient === 'Aile' && formData.familyMember ? ` (${formData.familyMember})` : ''}\n- Cinsiyet: ${formData.gender}, Yaş: ${formData.age}, Meslek: ${formData.profession || 'belirtilmemiş'}\n- İlgi Alanları: ${formData.interests.join(', ') || 'belirtilmemiş'}\n- Tarzı: ${formData.styles.join(', ') || 'belirtilmemiş'}\n- Notlar: ${formData.notes || 'yok'}\n- Şehir: ${formData.city}\n- Tarih: ${formData.date}\n${imageAnalysisRequest}\n\nGörevin, yaratıcı ve uygun öneriler sunmaktır. Her öneri için:\n1. Aktivite için akılda kalıcı bir isim ("activityName").\n2. Etkileyici bir açıklama ("description").\n3. Bu kişinin neden bundan hoşlanacağına dair kişiselleştirilmiş bir neden ("reason").\n4. Aktivite için bir kategori (örn: "Kültür & Sanat", "Yeme & İçme", "Macera", "Atölye", "Gezi") ("category").\n5. Varsa tahmini bir fiyat bilgisi veya aralığı ("price", örn: "150 TL", "500-800 TL", "Ücretsiz").\n6. Varsa doğrudan bilet alınabilecek bir link ("ticketLink", Biletix, Passo, Biletino gibi), yoksa etkinliğin detaylı bilgi sayfasına yönlendiren bir link ("link"). Link tam bir URL olmalıdır.\n\nÖNEMLİ: Tüm yanıtın YALNIZCA geçerli bir JSON dizi dizesi OLMALIDIR. JSON dizisinden önce veya sonra herhangi bir metin ekleme. JSON, her nesnenin yukarıda tanımlanan yapıyı izlediği bir nesne dizisi olmalıdır. Fiyat ve bilet linki bilgileri mevcut değilse, bu alanlar için "Belirtilmemiş" değerini kullan.`;
};


// --- CUSTOM HOOKS ---

/**
 * A reusable hook to manage the state and logic of a multi-step wizard.
 * @param {{initialState: object, totalSteps: number}} options
 * @returns All the necessary state and handlers for a wizard.
 */
const useWizard = ({ initialState, totalSteps }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState(initialState);

    const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const handleChange = ({ target: { name, value } }) => setFormData(prev => ({ ...prev, [name]: value }));
    
    const handleBudgetChange = ({ target: { name, value } }) => setFormData(prev => ({
        ...prev,
        budget: { ...prev.budget, [name]: value }
    }));

    const handleCheckboxChange = (fieldName) => (event) => {
        const { value, checked } = event.target;
        setFormData(prev => {
            const previousValues = prev[fieldName] || [];
            const newValues = checked ? [...previousValues, value] : previousValues.filter(item => item !== value);
            return { ...prev, [fieldName]: newValues };
        });
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setFormData(prev => ({
                ...prev,
                image: { data: reader.result as string, mimeType: file.type }
            }));
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setFormData(prev => ({ ...prev, image: { data: null, mimeType: null } }));
        const fileInput = document.getElementById('photo-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const progress = step > (totalSteps - 1) ? 100 : ((step - 1) / (totalSteps - 2)) * 100;
    
    return {
        step,
        formData,
        progress,
        nextStep,
        prevStep,
        handleChange,
        handleBudgetChange,
        handleCheckboxChange,
        handleImageChange,
        removeImage
    };
};

/**
 * A reusable hook for fetching AI suggestions.
 * @param {{formData: object, fetcher: (formData: object, ai: any) => Promise<object>}} options
 * @returns The state of the data fetching operation.
 */
const useSuggestions = ({ formData, fetcher }) => {
    const [data, setData] = useState({ suggestions: [], sources: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);

    useEffect(() => {
        const performFetch = async () => {
            setLoading(true);
            setError('');
            try {
                const result = await fetcher(formData, ai);
                setData(result);
            } catch (err) {
                console.error("API Error:", err);
                setError(err.message || 'Öneriler alınırken bir hata oluştu. Lütfen bilgileri kontrol edip tekrar deneyin.');
            } finally {
                setLoading(false);
            }
        };
        performFetch();
    }, [formData, fetcher, ai]);

    return { ...data, loading, error };
};


// --- REUSABLE UI COMPONENTS ---
const FormGroup = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string; }) => (
    <div className="form-group">
        <label>{label}{hint && <span className="label-hint">{hint}</span>}</label>
        {children}
    </div>
);

const RadioGroup = ({ name, options, selectedValue, onChange }) => (
    <div className="radio-group">
        {options.map(option => (
            <label key={option.value} className="radio-label">
                <input type="radio" name={name} value={option.value} checked={selectedValue === option.value} onChange={onChange} />
                <span>{option.label}</span>
            </label>
        ))}
    </div>
);

const CheckboxGroup = ({ name, options, selectedValues, onChange }) => (
    <div className="checkbox-group">
        {options.map(option => (
            <label key={option} className="checkbox-label">
                <input type="checkbox" name={name} value={option} checked={(selectedValues || []).includes(option)} onChange={onChange} />
                <span>{option}</span>
            </label>
        ))}
    </div>
);

const Navigation = ({ step, onBack, onNext, isNextDisabled = false, nextButtonText = "İleri" }) => (
    <div className="navigation-buttons">
        {step > 1 ? (<button onClick={onBack} className="btn btn-secondary">Geri</button>) : <div />}
        <button onClick={onNext} className="btn btn-primary" disabled={isNextDisabled}>{nextButtonText}</button>
    </div>
);

const Loader = ({ text }) => (
    <div className="loader-container">
        <div className="loader"></div>
        <p>{text}</p>
    </div>
);

const ErrorDisplay = ({ error, onRestart }) => (
    <div className="loader-container">
        <p style={{ color: 'var(--error-color)' }}>{error}</p>
        <button onClick={onRestart} className="btn btn-primary" style={{ marginTop: '1rem' }}>Baştan Başla</button>
    </div>
);

const ProgressBar = ({ progress }) => (
    <div className="progress-bar"><div className="progress-bar-inner" style={{ width: `${progress}%` }}></div></div>
);


// --- SHARED STEP COMPONENTS ---
const BasicInfo = ({ data, handleChange, onNext, onBack, step, nextButtonText }) => {
    const isNextDisabled = !data.gender || !data.age || !data.recipient || !data.occasion || (data.recipient === 'Aile' && !data.familyMember);
    return (
        <>
            <h2>Temel Bilgiler</h2>
            <FormGroup label="Cinsiyet"><RadioGroup name="gender" selectedValue={data.gender} onChange={handleChange} options={[{ value: 'Kadın', label: 'Kadın' }, { value: 'Erkek', label: 'Erkek' }, { value: 'Belirtilmemiş', label: 'Belirtilmemiş' }]} /></FormGroup>
            <FormGroup label="Yaş Aralığı"><RadioGroup name="age" selectedValue={data.age} onChange={handleChange} options={[{ value: '0-12', label: '0-12' }, { value: '13-17', label: '13-17' }, { value: '18-25', label: '18-25' }, { value: '26-35', label: '26-35' }, { value: '36-45', label: '36-45' }, { value: '46+', label: '46+' }]} /></FormGroup>
            <FormGroup label="Meslek">
                <select name="profession" value={data.profession} onChange={handleChange} className="select"><option value="">Seçiniz...</option>{professions.map(p => <option key={p} value={p}>{p}</option>)}</select>
            </FormGroup>
            <FormGroup label="Kime hediye alıyorsun?"><RadioGroup name="recipient" selectedValue={data.recipient} onChange={handleChange} options={[{ value: 'Sevgili', label: 'Sevgili' }, { value: 'Arkadaş', label: 'Arkadaş' }, { value: 'Aile', label: 'Aile' }, { value: 'İş Arkadaşı', label: 'İş Arkadaşı' }]} /></FormGroup>
            {data.recipient === 'Aile' && (<FormGroup label="Hangi Aile Üyesi?"><RadioGroup name="familyMember" selectedValue={data.familyMember} onChange={handleChange} options={familyMemberOptions.map(o => ({ value: o, label: o }))} /></FormGroup>)}
            <FormGroup label="Hediyenin Amacı"><RadioGroup name="occasion" selectedValue={data.occasion} onChange={handleChange} options={occasionOptions.map(o => ({ value: o, label: o }))} /></FormGroup>
            <Navigation step={step} onBack={onBack} onNext={onNext} isNextDisabled={isNextDisabled} nextButtonText={nextButtonText} />
        </>
    );
};

const Personality = ({ data, handleChange, handleCheckboxChange, handleImageChange, removeImage, onNext, onBack, step, nextButtonText }) => (
    <>
        <h2>Kişilik & İlgi Alanları</h2>
        <FormGroup label="Kişiyi anlatan bir fotoğraf ekle" hint="(isteğe bağlı)">
            <div className="photo-upload-area">
                <input type="file" id="photo-upload" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                <label htmlFor="photo-upload" className="btn btn-secondary">{data.image.data ? 'Fotoğrafı Değiştir' : 'Fotoğraf Seç'}</label>
                {data.image.data && (<div className="image-preview-container"><img src={data.image.data} alt="Önizleme" className="image-preview" /><button onClick={removeImage} className="remove-image-btn">&times;</button></div>)}
            </div>
            <p className="photo-upload-info">Yüklediğiniz fotoğraf, önerileri iyileştirmek için analiz edilecektir. Fotoğraf sunucularımıza kaydedilmez.</p>
        </FormGroup>
        <FormGroup label="İlgi Alanları" hint="(çoktan seçmeli)"><CheckboxGroup name="interests" options={interestsList} selectedValues={data.interests} onChange={handleCheckboxChange('interests')} /></FormGroup>
        <FormGroup label="Tarzı" hint="(çoktan seçmeli)"><CheckboxGroup name="styles" options={stylesList} selectedValues={data.styles} onChange={handleCheckboxChange('styles')} /></FormGroup>
        <FormGroup label="Renk Tercihi" hint="(isteğe bağlı)"><input type="text" name="color" value={data.color} onChange={handleChange} placeholder="Örn: Mavi, pastel tonlar..." className="input" /></FormGroup>
        <Navigation step={step} onBack={onBack} onNext={onNext} nextButtonText={nextButtonText} />
    </>
);

const OptionalNote = ({ data, handleChange, onNext, onBack, step, nextButtonText }) => (
    <>
        <h2>Opsiyonel Not</h2>
        <p>Küçük bir anı, ipucu ya da onu anlatan kelimeler gir.</p>
        <FormGroup label="Onu en iyi anlatan..." hint="(isteğe bağlı)"><textarea name="notes" value={data.notes} onChange={handleChange} className="textarea" placeholder="Örn: Her sabah kahve içer, kedileri çok sever..." /></FormGroup>
        <Navigation step={step} onBack={onBack} onNext={onNext} nextButtonText={nextButtonText} />
    </>
);


// --- GIFT WIZARD ---

const GiftIntro = ({ onNext }) => (
    <>
        <h1>Hediye Kutusu Sihirbazı</h1>
        <p>Sevdiklerin için en anlamlı hediyeyi bulmak üzere yola çıkalım. Birkaç adımı takip et ve sana özel hediye kutusu önerilerini gör.</p>
        <div className="navigation-buttons" style={{ justifyContent: 'center' }}><button onClick={onNext} className="btn btn-primary">Başla</button></div>
    </>
);

const Conditions = ({ data, handleChange, handleCheckboxChange, handleBudgetChange, onNext, onBack, step, nextButtonText }) => (
    <>
        <h2>Koşullar & Kısıtlar</h2>
        <FormGroup label="Hediye Tipi" hint="(çoktan seçmeli)"><CheckboxGroup name="giftType" options={giftTypeOptions} selectedValues={data.giftType} onChange={handleCheckboxChange('giftType')} /></FormGroup>
        <FormGroup label="Bütçe Aralığı (TL)">
             <div className="budget-group">
                <input type="number" name="min" value={data.budget.min} onChange={handleBudgetChange} placeholder="Min" className="input" min="0" />
                <input type="number" name="max" value={data.budget.max} onChange={handleBudgetChange} placeholder="Max" className="input" min="0" />
            </div>
        </FormGroup>
        <Navigation step={step} onBack={onBack} onNext={onNext} nextButtonText={nextButtonText} />
    </>
);

const GiftSuggestionCard = ({ item }) => (
    <div className="suggestion-card">
        <img src={`https://source.unsplash.com/random/400x300/?${encodeURIComponent(item.imageQuery)}`} alt={item.giftName} loading="lazy" />
        <div className="card-header"><h3>{item.giftName}</h3><span className="category-badge">{item.category}</span></div>
        <p>{item.description}</p>
        <p className="reason">{item.reason}</p>
        <div className="card-footer"><div className="price-range">{item.priceRange}</div></div>
        <div className="shopping-links">
            <a href={item.trendyolLink} target="_blank" rel="noopener noreferrer" className="btn btn-buy trendyol">Trendyol'da Ara</a>
            <a href={item.amazonLink} target="_blank" rel="noopener noreferrer" className="btn btn-buy amazon">Amazon'da Ara</a>
            <a href={item.hepsiburadaLink} target="_blank" rel="noopener noreferrer" className="btn btn-buy hepsiburada">Hepsiburada'da Ara</a>
        </div>
    </div>
);

const fetchGiftSuggestions = async (formData, ai) => {
    const prompt = buildGiftPrompt(formData);
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { giftName: { type: Type.STRING }, description: { type: Type.STRING }, reason: { type: Type.STRING }, category: { type: Type.STRING }, priceRange: { type: Type.STRING }, imageQuery: { type: Type.STRING }, trendyolLink: { type: Type.STRING }, amazonLink: { type: Type.STRING }, hepsiburadaLink: { type: Type.STRING } }, required: ["giftName", "description", "reason", "category", "priceRange", "imageQuery", "trendyolLink", "amazonLink", "hepsiburadaLink"] } };
    const modelRequest: any = { model: 'gemini-2.5-flash', config: { responseMimeType: "application/json", responseSchema: schema } };

    if (formData.image.data && formData.image.mimeType) {
        modelRequest.contents = { parts: [{ text: prompt }, { inlineData: { data: formData.image.data.split(',')[1], mimeType: formData.image.mimeType } }] };
    } else {
        modelRequest.contents = prompt;
    }
    const response = await ai.models.generateContent(modelRequest);
    const suggestions = JSON.parse(response.text.trim());
    return { suggestions, sources: [] };
};

const GiftSuggestions = ({ formData, onRestart }) => {
    const fetcher = useCallback(fetchGiftSuggestions, []);
    const { suggestions, loading, error } = useSuggestions({ formData, fetcher });

    if (loading) return <Loader text="Sizin için en iyi hediyeler hazırlanıyor..." />;
    if (error) return <ErrorDisplay error={error} onRestart={onRestart} />;
    
    return (
        <>
            <h2>İşte Öneriler!</h2>
            <div className="suggestions-grid">
                {suggestions.map((item, index) => <GiftSuggestionCard key={index} item={item} />)}
            </div>
            <div className="navigation-buttons" style={{ justifyContent: 'center', marginTop: '2rem' }}>
                <button onClick={onRestart} className="btn btn-secondary">Yeni Arama Yap</button>
            </div>
        </>
    );
};

const GiftWizard = ({ onRestart }) => {
    const wizard = useWizard({ initialState: initialFormState, totalSteps: 6 });

    const renderStep = () => {
        const props = { ...wizard, data: wizard.formData, onNext: wizard.nextStep, onBack: wizard.prevStep };
        switch (wizard.step) {
            case 1: return <GiftIntro onNext={wizard.nextStep} />;
            case 2: return <BasicInfo {...props} nextButtonText="İleri" />;
            case 3: return <Personality {...props} nextButtonText="İleri" />;
            case 4: return <Conditions {...props} nextButtonText="İleri" />;
            case 5: return <OptionalNote {...props} nextButtonText="Önerileri Getir" />;
            case 6: return <GiftSuggestions formData={wizard.formData} onRestart={onRestart} />;
            default: return <GiftIntro onNext={wizard.nextStep} />;
        }
    };
    
    return (
        <div className="app-container">
            {wizard.step > 1 && wizard.step < 6 && <ProgressBar progress={wizard.progress} />}
            <div className="step-content">{renderStep()}</div>
        </div>
    );
};

// --- ACTIVITY WIZARD ---

const ActivityIntro = ({ onNext }) => (
    <>
        <h1>Anı Yaratma Sihirbazı</h1>
        <p>Birlikte yaşanacak unutulmaz anlar planlayalım. Kişi ve etkinlik hakkında birkaç bilgi ver, sana özel deneyim rotaları çizelim.</p>
        <div className="navigation-buttons" style={{ justifyContent: 'center' }}><button onClick={onNext} className="btn btn-primary">Planlamaya Başla</button></div>
    </>
);

const EventDetails = ({ data, handleChange, onNext, onBack, step, nextButtonText }) => {
    const isNextDisabled = !data.city || !data.date;
    return (
        <>
            <h2>Etkinlik Detayları</h2>
            <p>Deneyimin nerede ve ne zaman yaşanacağını belirt.</p>
            <FormGroup label="Şehir"><input type="text" name="city" value={data.city} onChange={handleChange} placeholder="Örn: İstanbul, İzmir, Ankara..." className="input" required /></FormGroup>
            <FormGroup label="Tarih"><input type="date" name="date" value={data.date} onChange={handleChange} className="input" required min={new Date().toISOString().split("T")[0]} /></FormGroup>
            <Navigation step={step} onBack={onBack} onNext={onNext} isNextDisabled={isNextDisabled} nextButtonText={nextButtonText}/>
        </>
    );
};

const ActivitySuggestionCard = ({ item }) => (
    <div className="activity-card">
       <div className="card-header"><h3>{item.activityName}</h3><span className="category-badge">{item.category}</span></div>
       <p>{item.description}</p>
       <p className="reason">{item.reason}</p>
       <div className="activity-footer">
           {item.price && item.price !== "Belirtilmemiş" && <div className="price-tag">{item.price}</div>}
           <a href={item.ticketLink || item.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Bilet Al & Planla</a>
       </div>
   </div>
);

const fetchActivitySuggestions = async (formData, ai) => {
    const prompt = buildActivityPrompt(formData);
    const modelRequest: any = { model: "gemini-2.5-flash", config: { tools: [{ googleSearch: {} }] } };

    if (formData.image.data && formData.image.mimeType) {
        modelRequest.contents = { parts: [{ text: prompt }, { inlineData: { data: formData.image.data.split(',')[1], mimeType: formData.image.mimeType } }] };
    } else {
        modelRequest.contents = prompt;
    }
    
    const response = await ai.models.generateContent(modelRequest);
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => chunk.web) || [];
    const suggestions = parseJsonSafely(response.text);

    return { suggestions, sources };
};

const ActivitySuggestions = ({ formData, onRestart }) => {
    const fetcher = useCallback(fetchActivitySuggestions, []);
    const { suggestions, sources, loading, error } = useSuggestions({ formData, fetcher });

    if (loading) return <Loader text="Unutulmaz anılar planlanıyor..." />;
    if (error) return <ErrorDisplay error={error} onRestart={onRestart} />;

    return (
        <>
            <h2>İşte Unutulmaz Anılar İçin Fikirler!</h2>
            <div className="suggestions-grid">
                {suggestions.map((item, index) => <ActivitySuggestionCard key={index} item={item} />)}
            </div>
            {sources.length > 0 && (
                <div className="sources-container">
                    <h4>Bilgi Kaynakları</h4>
                    <ul className="sources-list">
                        {sources.map((source, index) => (
                            <li key={index}><a href={source.uri} target="_blank" rel="noopener noreferrer">{source.title || new URL(source.uri).hostname}</a></li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="navigation-buttons" style={{ justifyContent: 'center', marginTop: '2rem' }}>
                <button onClick={onRestart} className="btn btn-secondary">Yeni Arama Yap</button>
            </div>
        </>
    );
};

const ActivityWizard = ({ onRestart }) => {
    const wizard = useWizard({ initialState: initialFormState, totalSteps: 6 });

    const renderStep = () => {
        const props = { ...wizard, data: wizard.formData, onNext: wizard.nextStep, onBack: wizard.prevStep };
        switch (wizard.step) {
            case 1: return <ActivityIntro onNext={wizard.nextStep} />;
            case 2: return <BasicInfo {...props} nextButtonText="İleri" />;
            case 3: return <Personality {...props} nextButtonText="İleri" />;
            case 4: return <EventDetails {...props} nextButtonText="İleri" />;
            case 5: return <OptionalNote {...props} nextButtonText="Aktivite Önerileri Getir" />;
            case 6: return <ActivitySuggestions formData={wizard.formData} onRestart={onRestart} />;
            default: return <ActivityIntro onNext={wizard.nextStep} />;
        }
    };

    return (
        <div className="app-container">
            {wizard.step > 1 && wizard.step < 6 && <ProgressBar progress={wizard.progress} />}
            <div className="step-content">{renderStep()}</div>
        </div>
    );
};


// --- MAIN APP & MODE SELECTION ---
const ModeSelection = ({ onSelect }) => (
    <>
        <h2>Sürpriz Zamanı!</h2>
        <p>Harika bir hediye mi arıyorsun, yoksa unutulmaz bir anı mı planlamak istersin? Aşağıdan seçimini yap ve sihirbazı başlat.</p>
        <div className="mode-selection-buttons">
            <button onClick={() => onSelect('gift')} className="btn btn-primary btn-large">
                <div>🎁 Hediye Kutusu</div>
                <span>Kişiye özel, anlamlı bir hediye bul.</span>
            </button>
            <button onClick={() => onSelect('activity')} className="btn btn-primary btn-large">
                <div>🎉 Anı Yaşa</div>
                <span>Birlikte yaşanacak harika bir macera planla.</span>
            </button>
        </div>
    </>
);

const App = () => {
    const [mode, setMode] = useState<'gift' | 'activity' | null>(null);

    const handleRestart = useCallback(() => {
        setMode(null);
    }, []);

    useEffect(() => {
        const handleResetEvent = () => handleRestart();
        window.addEventListener('reset-app', handleResetEvent);
        return () => {
            window.removeEventListener('reset-app', handleResetEvent);
        };
    }, [handleRestart]);

    if (mode === 'gift') {
        return <GiftWizard onRestart={handleRestart} />;
    }

    if (mode === 'activity') {
        return <ActivityWizard onRestart={handleRestart} />;
    }

    return (
        <div className="app-container">
            <div className="step-content">
                <ModeSelection onSelect={setMode} />
            </div>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
