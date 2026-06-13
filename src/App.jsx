import React, { useState, useEffect } from 'react';
import {
  Shirt, LayoutGrid, Plus, Link as LinkIcon, Trash2,
  Heart, PoundSterling, Ruler, Store, CheckCircle2, AlertCircle, X, Camera, Save,
  Wand2, ChevronRight, LogOut
} from 'lucide-react';
import { doc, setDoc, deleteDoc, onSnapshot, collection, writeBatch, getDocs } from 'firebase/firestore';
import { auth, db, onAuthStateChanged, signInWithGoogle, signOutUser } from './firebase.js';

const SEASONS = ['All Seasons', 'Spring', 'Summer', 'Autumn', 'Winter'];
const ACCESSORY_SUBCATEGORIES = ['Bags', 'Sunglasses', 'Hats', 'Belts', 'Jewelry', 'Scarves', 'Other'];

const HOLLAND_COOPER_SEEDS = [
  { id: 'hc1', name: 'Amalfi Linen Short', category: 'Bottoms', price: 99, brand: 'Holland Cooper', status: 'owned', imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&q=80&w=600' },
  { id: 'hc2', name: 'Sleeveless Amalfi Linen Shirt', category: 'Tops', price: 129, brand: 'Holland Cooper', status: 'owned', imageUrl: 'https://images.unsplash.com/photo-1604085449216-29a3ebbebc81?auto=format&fit=crop&q=80&w=600' },
  { id: 'hc3', name: 'Pink Linen Sleeveless Shirt', category: 'Tops', price: 129, brand: 'Holland Cooper', status: 'owned', imageUrl: 'https://images.unsplash.com/photo-1582210967397-bb1b6976ce24?auto=format&fit=crop&q=80&w=600' },
  { id: 'hc4', name: 'Heraldic Monogram Slides', category: 'Shoes', price: 149, brand: 'Holland Cooper', status: 'owned', imageUrl: 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&q=80&w=600' },
  { id: 'hc5', name: 'High-rise Denim Short', category: 'Bottoms', price: 119, brand: 'Holland Cooper', status: 'owned', imageUrl: 'https://images.unsplash.com/photo-1591369822096-114cb300c355?auto=format&fit=crop&q=80&w=600' },
];

const INITIAL_MEASUREMENTS = { height: '', weight: '', chest: '', waist: '', hips: '', shoeSize: '' };
const INITIAL_SHOPS = [
  { id: '1', name: 'COS', url: 'https://www.cos.com', category: 'Minimalist' },
  { id: '2', name: 'Holland Cooper', url: 'https://www.hollandcooper.com', category: 'Luxury Heritage' },
];
const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Accessories'];

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11));

const userItemsRef = (uid) => collection(db, 'users', uid, 'items');
const userOutfitsRef = (uid) => collection(db, 'users', uid, 'outfits');
const userProfileDoc = (uid) => doc(db, 'users', uid, 'profile', 'measurements');

export default function DigitalWardrobe() {
  const [activeTab, setActiveTab] = useState('wardrobe');
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [measurements, setMeasurements] = useState(INITIAL_MEASUREMENTS);
  const [shops, setShops] = useState(INITIAL_SHOPS);
  const [outfits, setOutfits] = useState([]);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const seedIfEmpty = async () => {
      const snap = await getDocs(userItemsRef(user.uid));
      if (snap.empty) {
        const batch = writeBatch(db);
        HOLLAND_COOPER_SEEDS.forEach((item) => batch.set(doc(userItemsRef(user.uid), item.id), item));
        await batch.commit();
      }
    };
    seedIfEmpty().catch((err) => console.error('seed failed', err));

    const unsubItems = onSnapshot(
      userItemsRef(user.uid),
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
      },
      (err) => { console.error(err); setLoading(false); }
    );
    const unsubOutfits = onSnapshot(userOutfitsRef(user.uid), (snap) =>
      setOutfits(snap.docs.map((d) => ({ ...d.data(), id: d.id })))
    );
    const unsubProfile = onSnapshot(userProfileDoc(user.uid), (snap) => {
      if (snap.exists()) setMeasurements({ ...INITIAL_MEASUREMENTS, ...snap.data() });
    });

    return () => { unsubItems(); unsubOutfits(); unsubProfile(); };
  }, [user]);

  const handleAddItem = async (newItem) => {
    if (!user) return;
    await setDoc(doc(userItemsRef(user.uid), newItem.id), newItem);
  };
  const handleDeleteItem = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userItemsRef(user.uid), id));
  };
  const handleSaveOutfit = async (outfit) => {
    if (!user) return;
    await setDoc(doc(userOutfitsRef(user.uid), outfit.id), outfit);
  };
  const handleSaveProfile = async (newMeasurements) => {
    if (!user) return;
    await setDoc(userProfileDoc(user.uid), newMeasurements);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Jost', sans-serif; }
        .glass-panel { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.4); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .smooth-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        body { background-color: #F7F5F2; }
      `}</style>

      {!authReady ? (
        <FullScreenLoader label="Opening your atelier" />
      ) : !user ? (
        <SignInScreen onSignIn={signInWithGoogle} />
      ) : (
        <div className="flex h-screen font-sans text-stone-900 overflow-hidden bg-[#F7F5F2]">
          <aside className="hidden lg:flex flex-col w-72 bg-[#F7F5F2] border-r border-stone-200/60 p-8 h-full">
            <div className="flex items-center gap-3 mb-16">
              <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center shadow-lg">
                <Shirt className="text-[#F7F5F2]" size={18} strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl font-display font-medium tracking-wide">Atelier.</h1>
            </div>

            <nav className="space-y-4 flex-1">
              <DesktopNavItem id="wardrobe" icon={LayoutGrid} label="Wardrobe" activeTab={activeTab} setTab={setActiveTab} />
              <DesktopNavItem id="outfits" icon={Camera} label="Styling Studio" activeTab={activeTab} setTab={setActiveTab} />
              <DesktopNavItem id="finance" icon={PoundSterling} label="Collection Value" activeTab={activeTab} setTab={setActiveTab} />
              <DesktopNavItem id="profile" icon={Ruler} label="Measurements" activeTab={activeTab} setTab={setActiveTab} />
              <DesktopNavItem id="shops" icon={Store} label="Directory" activeTab={activeTab} setTab={setActiveTab} />
            </nav>

            <div className="border-t border-stone-200/60 pt-6 mt-6">
              <div className="flex items-center gap-3 px-3 mb-3">
                {user.photoURL && <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user.displayName || 'Account'}</p>
                  <p className="text-[10px] text-stone-500 truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={signOutUser} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-stone-500 hover:bg-stone-200/50 hover:text-stone-800 transition-colors">
                <LogOut size={14} strokeWidth={1.5} /> Sign out
              </button>
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto pb-24 lg:pb-0 relative scroll-smooth hide-scrollbar">
            <div className="p-6 lg:p-12 max-w-6xl mx-auto min-h-full">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 font-display text-2xl animate-pulse">
                  <Shirt size={40} className="mb-4 opacity-20" strokeWidth={1} />
                  Curating your collection...
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                  {activeTab === 'wardrobe' && <WardrobeView items={items} deleteItem={handleDeleteItem} openAddModal={() => setIsAddItemModalOpen(true)} measurements={measurements} />}
                  {activeTab === 'outfits' && <OutfitBuilder items={items} outfits={outfits} saveOutfit={handleSaveOutfit} />}
                  {activeTab === 'finance' && <FinanceView items={items} />}
                  {activeTab === 'profile' && <ProfileView measurements={measurements} saveMeasurements={handleSaveProfile} />}
                  {activeTab === 'shops' && <ShoppingDirectory shops={shops} setShops={setShops} />}
                </div>
              )}
            </div>
          </main>

          <div className="lg:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/50 px-2 sm:px-6 pb-safe pt-2 z-40 smooth-shadow">
            <div className="flex justify-between items-center max-w-md mx-auto py-2">
              <MobileNavItem id="wardrobe" icon={LayoutGrid} label="Wardrobe" activeTab={activeTab} setTab={setActiveTab} />
              <MobileNavItem id="shops" icon={Store} label="Directory" activeTab={activeTab} setTab={setActiveTab} />
              <div className="relative -top-6">
                <button onClick={() => setIsAddItemModalOpen(true)} className="w-14 h-14 shrink-0 bg-stone-900 rounded-full flex items-center justify-center text-white smooth-shadow hover:scale-105 transition-transform">
                  <Plus size={24} strokeWidth={1.5} />
                </button>
              </div>
              <MobileNavItem id="outfits" icon={Camera} label="Styling" activeTab={activeTab} setTab={setActiveTab} />
              <MobileNavItem id="profile" icon={Ruler} label="Profile" activeTab={activeTab} setTab={setActiveTab} />
            </div>
          </div>

          {isAddItemModalOpen && (
            <AddItemModal
              user={user}
              onClose={() => setIsAddItemModalOpen(false)}
              onAdd={(newItem) => { handleAddItem(newItem); setIsAddItemModalOpen(false); }}
            />
          )}
        </div>
      )}
    </>
  );
}

function FullScreenLoader({ label }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F2] text-stone-400">
      <Shirt size={40} className="mb-4 opacity-30 animate-pulse" strokeWidth={1} />
      <p className="font-display text-xl">{label}…</p>
    </div>
  );
}

function SignInScreen({ onSignIn }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true); setError(null);
    try { await onSignIn(); }
    catch (e) { setError(e?.message || 'Sign-in failed.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F2] px-6 font-sans">
      <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center shadow-lg mb-8">
        <Shirt className="text-[#F7F5F2]" size={28} strokeWidth={1.5} />
      </div>
      <h1 className="text-5xl font-display font-medium tracking-wide mb-3">Atelier.</h1>
      <p className="text-stone-500 text-sm tracking-wide mb-12 text-center max-w-sm">Your private digital wardrobe. Sign in to access your collection from any device.</p>
      <button onClick={handle} disabled={busy} className="bg-stone-900 text-white px-10 py-4 rounded-full font-medium hover:bg-stone-800 transition-all shadow-lg disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && <p className="mt-6 text-xs text-red-700 max-w-sm text-center">{error}</p>}
    </div>
  );
}

function DesktopNavItem({ icon: Icon, label, id, activeTab, setTab }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setTab(id)}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 ${
        isActive ? 'bg-white smooth-shadow text-stone-900' : 'text-stone-500 hover:bg-stone-200/50 hover:text-stone-800'
      }`}
    >
      <div className="flex items-center gap-4">
        <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
        <span className={`text-sm tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>{label}</span>
      </div>
      {isActive && <ChevronRight size={16} className="text-stone-400" strokeWidth={1.5} />}
    </button>
  );
}

function MobileNavItem({ icon: Icon, label, id, activeTab, setTab }) {
  const isActive = activeTab === id;
  return (
    <button onClick={() => setTab(id)} className="flex flex-col items-center gap-1.5 p-2 w-16">
      <Icon size={22} strokeWidth={isActive ? 2 : 1.5} className={`transition-colors ${isActive ? 'text-stone-900' : 'text-stone-400'}`} />
      <span className={`text-[10px] tracking-wide transition-colors ${isActive ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>{label}</span>
    </button>
  );
}

function WardrobeView({ items, deleteItem, openAddModal, measurements }) {
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [seasonFilter, setSeasonFilter] = useState('All Seasons');

  const filteredItems = items.filter(item => {
    const matchFilter = filter === 'all' || item.status === filter;
    const matchCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchSeason = seasonFilter === 'All Seasons' || !item.season || item.season === 'All Seasons' || item.season === seasonFilter;
    return matchFilter && matchCategory && matchSeason;
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-display text-stone-900 tracking-tight">Collection</h2>
          <p className="text-stone-500 mt-3 text-sm tracking-wide uppercase font-medium">
            {items.length} Pieces Curated
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="hidden lg:flex bg-stone-900 text-white px-8 py-3.5 rounded-full text-sm font-medium items-center gap-2 hover:bg-stone-800 transition-all smooth-shadow"
        >
          <Plus size={18} strokeWidth={1.5} /> Add to Collection
        </button>
      </header>

      <div className="flex flex-col gap-6">
        <div className="flex bg-stone-200/50 p-1.5 rounded-full w-fit">
          {['all', 'owned', 'wishlist'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-full text-xs tracking-wider uppercase transition-all duration-300 ${
                filter === f ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex overflow-x-auto pb-2 gap-3 items-center hide-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-5 py-2 rounded-full text-sm transition-all duration-300 border whitespace-nowrap ${
                  categoryFilter === cat ? 'bg-stone-900 border-stone-900 text-white' : 'bg-transparent border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex overflow-x-auto pb-4 gap-3 items-center hide-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0">
            {SEASONS.map((season) => (
              <button key={season} onClick={() => setSeasonFilter(season)}
                className={`px-4 py-1.5 rounded-full text-xs transition-all duration-300 border whitespace-nowrap ${
                  seasonFilter === season ? 'bg-stone-200 border-stone-300 text-stone-900 font-medium' : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100'
                }`}
              >
                {season}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-8 md:gap-y-12">
        {filteredItems.map(item => (
          <div key={item.id} className="group relative flex flex-col gap-4">
            <div className="aspect-[3/4] rounded-2xl bg-stone-100 relative overflow-hidden smooth-shadow">
              <button
                onClick={() => deleteItem(item.id)}
                className="absolute top-4 right-4 z-20 p-2.5 bg-white/80 backdrop-blur-md text-stone-900 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 shadow-sm"
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>

              <div className="absolute top-4 left-4 z-20">
                {item.status === 'wishlist' && (
                  <span className="glass-panel text-stone-900 text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                    <Heart size={12} className="fill-stone-900" strokeWidth={0} /> Wishlist
                  </span>
                )}
              </div>

              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" loading="lazy" />
            </div>

            <div className="px-1">
              <div className="flex justify-between items-start mb-1.5 gap-4">
                <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">
                  {item.brand} {item.season && item.season !== 'All Seasons' && `• ${item.season}`}
                </p>
                <p className="text-sm font-medium text-stone-900 shrink-0">£{item.price}</p>
              </div>
              <h3 className="font-display text-lg text-stone-800 leading-snug">{item.name}</h3>
              {item.subCategory && (
                <p className="text-xs text-stone-500 mt-1">{item.category} • {item.subCategory}</p>
              )}

              {item.status === 'wishlist' && (
                <div className={`mt-3 text-[11px] py-2 px-3 rounded-lg flex items-start gap-2 ${
                  !measurements.waist ? 'bg-stone-100 text-stone-500' :
                  (item.fitScore > 75 ? 'bg-stone-900 text-white' : 'bg-orange-50 text-orange-800 border border-orange-200/50')
                }`}>
                  {!measurements.waist ? (
                    <><AlertCircle size={14} className="shrink-0 mt-0.5" strokeWidth={1.5} /> <span>Add profile measurements to unlock fit prediction.</span></>
                  ) : item.fitScore > 75 ? (
                    <><CheckCircle2 size={14} className="shrink-0 mt-0.5" strokeWidth={1.5} /> <span>Based on your profile, this is a strong fit match.</span></>
                  ) : (
                    <><AlertCircle size={14} className="shrink-0 mt-0.5" strokeWidth={1.5} /> <span>Review size guide; proportions vary from profile.</span></>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-stone-400 bg-white/50 border border-dashed border-stone-300 rounded-3xl">
            <Shirt size={48} strokeWidth={1} className="mb-6 opacity-50" />
            <p className="text-lg font-display tracking-wide">Your collection is empty.</p>
            <p className="text-sm mt-2">Try adjusting your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Resize an image File to a small JPEG data URL we can safely embed in a
// Firestore document (Spark plan has no Storage; the 1 MiB per-doc limit
// is the constraint). 800px max + quality 0.75 gives ~50–150 KB per image.
function resizeImageToDataUrl(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Firestore doc size cap is 1,048,487 bytes; base64 inflates by ~33%.
        // Reject anything over 900 KB so we never hit that wall.
        if (dataUrl.length > 900_000) {
          reject(new Error('Image is too large after compression. Try a simpler photo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AddItemModal({ user, onClose, onAdd }) {
  const [step, setStep] = useState(1);
  const [linkInput, setLinkInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '', brand: '', price: '', category: 'Tops', subCategory: '',
    season: 'All Seasons', status: 'owned', imageUrl: '',
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true); setError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 800, 0.75);
      setFormData((prev) => ({
        ...prev,
        imageUrl: dataUrl,
        name: prev.name || 'New Capture',
        brand: prev.brand || 'Unknown',
      }));
      setStep(2);
    } catch (err) {
      setError(err?.message || 'Could not process image.');
    } finally {
      setIsLoading(false);
    }
  };

  const simulateLinkImport = (e) => {
    e.preventDefault();
    if (!linkInput) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setFormData({
        ...formData, name: 'Sleeveless Amalfi Linen Shirt', brand: 'Holland Cooper', price: '129',
        imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600',
        status: 'wishlist', season: 'Summer', subCategory: '',
      });
      setStep(2);
    }, 1500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true); setError(null);
    try {
      await onAdd({
        ...formData,
        id: newId(),
        price: Number(formData.price) || 0,
        fitScore: Math.floor(Math.random() * 40) + 60,
      });
    } catch (err) {
      setError(err?.message || 'Save failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6 transition-all">
      <div className="bg-[#F7F5F2] w-full sm:max-w-xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
        <div className="flex justify-between items-center p-6 border-b border-stone-200/60 bg-white">
          <h3 className="text-2xl font-display font-medium text-stone-900">Add to Atelier</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 sm:p-10 max-h-[80vh] overflow-y-auto">
          {step === 1 ? (
            <div className="space-y-8">
              <p className="text-stone-500 text-sm leading-relaxed">
                Add items to your digital wardrobe via a product link from your favorite store, or capture an item you already own.
              </p>

              <form onSubmit={simulateLinkImport} className="space-y-3">
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase">Import via Link</label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon size={18} className="text-stone-400" strokeWidth={1.5} />
                  </div>
                  <input
                    type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="Paste URL (e.g. hollandcooper.com/...)"
                    className="block w-full pl-12 pr-32 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                    required
                  />
                  <button
                    type="submit" disabled={isLoading}
                    className="absolute right-2 top-2 bottom-2 bg-stone-900 text-white px-6 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Scanning...' : 'Extract'}
                  </button>
                </div>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-stone-200"></div>
                <span className="flex-shrink-0 mx-4 text-stone-400 text-xs tracking-widest uppercase">Or</span>
                <div className="flex-grow border-t border-stone-200"></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="group flex flex-col items-center justify-center p-8 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all">
                  <Camera size={28} strokeWidth={1} className="mb-4 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-sm text-stone-900">Take Photo</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                </label>
                <button onClick={() => setStep(2)} className="group flex flex-col items-center justify-center p-8 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all">
                  <Plus size={28} strokeWidth={1} className="mb-4 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-sm text-stone-900">Manual Entry</span>
                </button>
              </div>
              {error && <p className="text-xs text-red-700">{error}</p>}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="sm:w-2/5 aspect-[3/4] bg-white rounded-2xl border border-stone-200 flex flex-col items-center justify-center text-stone-400 overflow-hidden relative smooth-shadow">
                  {formData.imageUrl ? (
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <><Camera size={24} className="mb-2" strokeWidth={1.5} /><span className="text-xs">No Image</span></>
                  )}
                </div>
                <div className="flex-1 space-y-5">
                  {!formData.imageUrl?.startsWith('data:') && (
                    <Input label="Image URL" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} type="text" />
                  )}
                  <Input label="Product Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" required />
                  <Input label="Brand Designer" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} type="text" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <Input label="Price (£)" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} type="number" step="0.01" required />
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, subCategory: ''})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors">
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {formData.category === 'Accessories' && (
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Accessory Type</label>
                  <select value={formData.subCategory} onChange={e => setFormData({...formData, subCategory: e.target.value})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors">
                    <option value="">Select type...</option>
                    {ACCESSORY_SUBCATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Season</label>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                  {SEASONS.map(season => (
                    <button key={season} type="button" onClick={() => setFormData({...formData, season})}
                      className={`flex-none px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                        formData.season === season ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                      }`}
                    >
                      {season}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-3">Collection Status</label>
                <div className="flex gap-4">
                  {['owned', 'wishlist'].map(status => (
                    <button key={status} type="button" onClick={() => setFormData({...formData, status})}
                      className={`flex-1 py-4 rounded-xl text-sm font-medium capitalize transition-all border ${
                        formData.status === status ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-red-700">{error}</p>}

              <button type="submit" disabled={isLoading} className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium mt-4 hover:bg-stone-800 transition-colors shadow-lg disabled:opacity-50">
                {isLoading ? 'Saving…' : 'Save to Collection'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">{label}</label>
      <input className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors" {...props} />
    </div>
  );
}

function OutfitBuilder({ items, outfits, saveOutfit }) {
  const [currentOutfit, setCurrentOutfit] = useState({ tops: null, bottoms: null, shoes: null, accessories: null });
  const [outfitName, setOutfitName] = useState('');

  const handleSelect = (category, item) => setCurrentOutfit(prev => ({ ...prev, [category.toLowerCase()]: item }));

  const handleSave = () => {
    if (!outfitName.trim() || Object.values(currentOutfit).filter(Boolean).length === 0) return;
    saveOutfit({ id: newId(), name: outfitName, items: Object.values(currentOutfit).filter(Boolean) });
    setOutfitName(''); setCurrentOutfit({ tops: null, bottoms: null, shoes: null, accessories: null });
  };

  const generateSuggestion = () => {
    const getRand = (cat) => {
      const arr = items.filter(i => i.category === cat || (cat === 'Tops' && i.category === 'Outerwear'));
      return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    };
    setCurrentOutfit({ tops: getRand('Tops'), bottoms: getRand('Bottoms'), shoes: getRand('Shoes'), accessories: getRand('Accessories') });
  };

  const OutfitSlot = ({ category, item }) => (
    <div className={`border border-stone-200 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 ${item ? 'bg-white smooth-shadow' : 'bg-stone-100 border-dashed border-stone-300'} h-56 group`}>
      {item ? (
        <>
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          <button onClick={() => handleSelect(category, null)} className="absolute top-3 right-3 bg-white/90 backdrop-blur text-stone-900 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 shadow-sm"><X size={14} strokeWidth={2} /></button>
        </>
      ) : (
        <span className="text-stone-400 text-xs font-medium tracking-widest uppercase">{category}</span>
      )}
    </div>
  );

  return (
    <div className="space-y-10 lg:h-[calc(100vh-120px)] flex flex-col">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 shrink-0">
        <div>
          <h2 className="text-4xl md:text-5xl font-display text-stone-900 tracking-tight">Styling Studio</h2>
          <p className="text-stone-500 mt-3 text-sm tracking-wide">Compose and save editorial looks.</p>
        </div>
        <button onClick={generateSuggestion} className="bg-white border border-stone-200 text-stone-900 px-6 py-3 rounded-full text-sm font-medium flex items-center justify-center gap-2 hover:border-stone-900 transition-all smooth-shadow">
          <Wand2 size={16} strokeWidth={1.5} /> Auto-Style Look
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:min-h-0 flex-1">
        <div className="lg:col-span-5 bg-white rounded-[2rem] p-8 border border-stone-200/60 smooth-shadow flex flex-col">
          <h3 className="font-display text-2xl mb-8 text-stone-900">Current Look</h3>
          <div className="flex-1 space-y-4 overflow-y-auto hide-scrollbar pr-2">
            <OutfitSlot category="Tops" item={currentOutfit.tops} />
            <OutfitSlot category="Bottoms" item={currentOutfit.bottoms} />
            <div className="grid grid-cols-2 gap-4">
              <OutfitSlot category="Shoes" item={currentOutfit.shoes} />
              <OutfitSlot category="Accessories" item={currentOutfit.accessories} />
            </div>
          </div>

          <div className="mt-8 shrink-0">
            <input type="text" placeholder="Name this look..." value={outfitName} onChange={(e) => setOutfitName(e.target.value)}
              className="w-full px-5 py-4 rounded-xl bg-stone-50 border border-stone-200 mb-4 focus:border-stone-900 outline-none transition-colors"
            />
            <button onClick={handleSave} disabled={!outfitName.trim() || Object.values(currentOutfit).every(v => v === null)}
              className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium flex justify-center items-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50 shadow-lg"
            >
              <Save size={18} strokeWidth={1.5} /> Save Look
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-transparent rounded-[2rem] flex flex-col lg:min-h-0 overflow-y-auto hide-scrollbar pb-10 lg:pb-0">
          <h3 className="font-display text-2xl mb-8 text-stone-900 px-2">Wardrobe Archives</h3>
          <div className="space-y-12">
            {['Tops', 'Bottoms', 'Shoes', 'Accessories'].map(category => (
              <div key={category}>
                <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-[0.2em] mb-4 px-2">{category}</h4>
                <div className="flex gap-4 overflow-x-auto pb-6 hide-scrollbar px-2">
                  {items.filter(i => i.category === category || (category === 'Tops' && i.category === 'Outerwear')).map(item => (
                    <div key={item.id} onClick={() => handleSelect(category, item)} className="flex-none w-36 cursor-pointer group">
                      <div className={`aspect-[3/4] rounded-2xl overflow-hidden mb-3 border-[3px] transition-all duration-300 ${
                        currentOutfit[category.toLowerCase()]?.id === item.id ? 'border-stone-900 shadow-xl' : 'border-transparent group-hover:border-stone-300'
                      }`}>
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                      </div>
                      <p className="text-xs font-medium text-stone-900 truncate px-1">{item.name}</p>
                      <p className="text-[10px] text-stone-500 uppercase tracking-wider px-1 mt-0.5">{item.brand}</p>
                    </div>
                  ))}
                  {items.filter(i => i.category === category || (category === 'Tops' && i.category === 'Outerwear')).length === 0 && (
                    <div className="w-full py-8 text-center text-stone-400 text-sm border border-dashed border-stone-300 rounded-2xl">No pieces in this category.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceView({ items }) {
  const ownedItems = items.filter(i => i.status === 'owned');
  const wishlistItems = items.filter(i => i.status === 'wishlist');
  const ownedTotal = ownedItems.reduce((sum, i) => sum + i.price, 0);
  const wishlistTotal = wishlistItems.reduce((sum, i) => sum + i.price, 0);
  const categoryBreakdown = ownedItems.reduce((acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.price; return acc; }, {});

  return (
    <div className="space-y-12 max-w-4xl">
      <header>
        <h2 className="text-4xl md:text-5xl font-display text-stone-900 tracking-tight">Collection Value</h2>
        <p className="text-stone-500 mt-3 text-sm tracking-wide">Financial overview of your curated pieces.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-stone-900 text-white p-10 rounded-[2rem] shadow-2xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 opacity-5 rotate-12"><PoundSterling size={240} strokeWidth={1} /></div>
          <p className="text-stone-400 text-xs font-semibold tracking-[0.2em] uppercase mb-4 relative z-10">Current Archive Value</p>
          <h3 className="text-6xl font-display relative z-10 font-medium">£{ownedTotal.toLocaleString()}</h3>
          <p className="text-sm text-stone-400 mt-8 relative z-10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-stone-500"></span>
            Across {ownedItems.length} curated items
          </p>
        </div>

        <div className="bg-white border border-stone-200/60 p-10 rounded-[2rem] smooth-shadow">
          <p className="text-stone-500 text-xs font-semibold tracking-[0.2em] uppercase mb-4">Wishlist Target</p>
          <h3 className="text-5xl font-display text-stone-900">£{wishlistTotal.toLocaleString()}</h3>
          <p className="text-sm text-stone-500 mt-8 flex items-center gap-2">
            <Heart size={14} className="text-stone-400" />
            {wishlistItems.length} items desired
          </p>
        </div>
      </div>

      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-10 smooth-shadow">
        <h3 className="font-display text-2xl text-stone-900 mb-8">Investment by Category</h3>
        <div className="space-y-6">
          {Object.entries(categoryBreakdown).map(([category, value]) => {
            const percentage = ownedTotal > 0 ? (value / ownedTotal) * 100 : 0;
            return (
              <div key={category} className="group">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-stone-800 tracking-wide uppercase text-xs">{category}</span>
                  <span className="text-stone-500">£{value.toLocaleString()} <span className="text-stone-300 ml-2">({percentage.toFixed(0)}%)</span></span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-stone-900 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            );
          })}
          {Object.keys(categoryBreakdown).length === 0 && <p className="text-stone-400 italic">No items owned yet.</p>}
        </div>
      </div>
    </div>
  );
}

function ProfileView({ measurements, saveMeasurements }) {
  const [localMeasurements, setLocalMeasurements] = useState(measurements || INITIAL_MEASUREMENTS);

  useEffect(() => { if (measurements) setLocalMeasurements({ ...INITIAL_MEASUREMENTS, ...measurements }); }, [measurements]);
  const handleChange = (e) => setLocalMeasurements({ ...localMeasurements, [e.target.name]: e.target.value });

  return (
    <div className="space-y-12 max-w-3xl">
      <header>
        <h2 className="text-4xl md:text-5xl font-display text-stone-900 tracking-tight">Measurements</h2>
        <p className="text-stone-500 mt-3 text-sm tracking-wide">Your tailored profile for automated fit predictions.</p>
      </header>

      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-8 md:p-12 smooth-shadow">
        <div className="bg-stone-50 border border-stone-200 text-stone-600 p-5 rounded-2xl text-sm flex gap-4 mb-10 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5 text-stone-900" size={20} strokeWidth={1.5} />
          <p>We use these measurements to simulate a <strong>"Fit Score"</strong> against items in your wishlist. This ensures garments flatter your proportions before purchasing.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {[
            { id: 'height', label: 'Height (cm)' }, { id: 'weight', label: 'Weight (kg)' },
            { id: 'chest', label: 'Chest (cm)' }, { id: 'waist', label: 'Waist (cm)' },
            { id: 'hips', label: 'Hips (cm)' }, { id: 'shoeSize', label: 'Shoe Size (EU)' },
          ].map(field => (
            <div key={field.id} className="relative">
              <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2 ml-1">{field.label}</label>
              <input type="number" name={field.id} value={localMeasurements[field.id] || ''} onChange={handleChange}
                className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:border-stone-900 outline-none transition-all text-stone-900"
              />
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-stone-100 flex justify-end">
          <button onClick={() => saveMeasurements(localMeasurements)} className="bg-stone-900 text-white px-8 py-4 rounded-xl font-medium flex items-center gap-3 hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl">
            <Save size={18} strokeWidth={1.5} /> Update Profile
          </button>
        </div>
      </div>
    </div>
  );
}

function ShoppingDirectory({ shops, setShops }) {
  const [newShop, setNewShop] = useState({ name: '', url: '', category: '' });

  const addShop = (e) => {
    e.preventDefault();
    if (!newShop.name || !newShop.url) return;
    setShops([...shops, { ...newShop, id: newId() }]);
    setNewShop({ name: '', url: '', category: '' });
  };

  return (
    <div className="space-y-12 max-w-5xl">
      <header>
        <h2 className="text-4xl md:text-5xl font-display text-stone-900 tracking-tight">Directory</h2>
        <p className="text-stone-500 mt-3 text-sm tracking-wide">Your curated list of trusted designers and boutiques.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <div className="bg-white border border-stone-200/60 rounded-[2rem] p-8 smooth-shadow sticky top-8">
            <h3 className="font-display text-2xl mb-6 text-stone-900">Add Boutique</h3>
            <form onSubmit={addShop} className="space-y-5">
              <Input label="Boutique Name" value={newShop.name} onChange={e => setNewShop({...newShop, name: e.target.value})} type="text" required />
              <Input label="Website Link" value={newShop.url} onChange={e => setNewShop({...newShop, url: e.target.value})} type="url" placeholder="https://" required />
              <Input label="Aesthetic / Category" value={newShop.category} onChange={e => setNewShop({...newShop, category: e.target.value})} type="text" placeholder="e.g. Minimalist Basics" />
              <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-all mt-4">Save to Directory</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 grid gap-4 align-top content-start">
          {shops.map(shop => (
            <div key={shop.id} className="bg-white border border-stone-200/60 rounded-2xl p-6 flex items-center justify-between hover:shadow-lg transition-all group duration-300">
              <div>
                <h4 className="font-display text-xl text-stone-900">{shop.name}</h4>
                <div className="flex items-center gap-4 mt-2">
                  <a href={shop.url} target="_blank" rel="noopener noreferrer" className="text-xs tracking-wider uppercase font-semibold text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5">
                    <LinkIcon size={12} strokeWidth={2} /> Visit Store
                  </a>
                  {shop.category && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                      <span className="text-stone-500 text-xs tracking-widest uppercase">{shop.category}</span>
                    </>
                  )}
                </div>
              </div>
              <button onClick={() => setShops(shops.filter(s => s.id !== shop.id))}
                className="text-stone-300 hover:text-red-500 p-3 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={20} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          {shops.length === 0 && <p className="text-stone-400 italic text-center py-10 border border-dashed border-stone-300 rounded-2xl">No boutiques added yet.</p>}
        </div>
      </div>
    </div>
  );
}
