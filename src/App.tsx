/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Settings, Power, LogOut, Send, AlertTriangle, Users, History, MessageSquare, Save, Key, Copy } from 'lucide-react';

export default function App() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [step, setStep] = useState(1); // 1 = Phone, 2 = Code, 3 = Dashboard
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [targetGroups, setTargetGroups] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[]>([]);
  const [msgText, setMsgText] = useState('NEW LIKE GROUP NO ADD NO VERIFICATION 👇');
  const [btnText, setBtnText] = useState('JOIN LIKE GROUP');
  const [btnLink, setBtnLink] = useState('https://t.me/gt1490bot');
  const [rateLimitUsers, setRateLimitUsers] = useState(5);
  const [rateLimitWindowMinutes, setRateLimitWindowMinutes] = useState(20);
  const [isSavingMessage, setIsSavingMessage] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'session'>('phone');
  const [sessionInput, setSessionInput] = useState('');
  const [copiedInfo, setCopiedInfo] = useState('');

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step === 3 && status?.isConnected) {
      fetchGroups();
      fetchSettings();
      fetchHistory();
    }
  }, [step, status?.isConnected]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
      if (data.isConnected && step !== 3) {
        setStep(3);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (data.groups) {
        setGroups(data.groups);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.targetGroups) {
        setTargetGroups(new Set(data.targetGroups));
      }
      if (data.msgText) setMsgText(data.msgText);
      if (data.btnText) setBtnText(data.btnText);
      if (data.btnLink) setBtnLink(data.btnLink);
      if (typeof data.rateLimitUsers === 'number') setRateLimitUsers(data.rateLimitUsers);
      if (typeof data.rateLimitWindowMinutes === 'number') setRateLimitWindowMinutes(data.rateLimitWindowMinutes);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.history) {
        setHistory(data.history.reverse()); // Show newest first
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendCode = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/sendCode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setPhoneCodeHash(data.phoneCodeHash);
        setStep(2);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          phoneCodeHash,
          phoneCode: code.trim()
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep(3);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSessionLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/loginSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionStr: sessionInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStep(3);
        fetchStatus();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to log out?')) return;
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setStep(1);
      setPhone('');
      setCode('');
      setPhoneCodeHash('');
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleBot = async (active: boolean) => {
    try {
      await fetch('/api/bot/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      fetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const saveTargetGroups = async (newTargets: Set<string>) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: Array.from(newTargets) })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const saveMessageSettings = async () => {
    setIsSavingMessage(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgText, btnText, btnLink, rateLimitUsers, rateLimitWindowMinutes })
      });
    } catch (e) {
      console.error(e);
    }
    setIsSavingMessage(false);
  };

  const toggleGroup = (groupId: string) => {
    const newTargets = new Set(targetGroups);
    if (newTargets.has(groupId)) {
      newTargets.delete(groupId);
    } else {
      newTargets.add(groupId);
    }
    setTargetGroups(newTargets);
    saveTargetGroups(newTargets);
  };

  const cooldownActive = status?.cooldownUntil && Date.now() < status.cooldownUntil;
  const cooldownRemaining = cooldownActive 
    ? Math.ceil((status.cooldownUntil - Date.now()) / 60000) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="text-blue-500" />
              Telegram Auto-DM Bot
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Monitors groups and auto-messages non-admin users.
            </p>
          </div>
          {step === 3 && (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-md transition"
            >
              <LogOut size={16} /> Disconnect
            </button>
          )}
        </div>

        {/* Note on Limitation */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 text-sm text-blue-200">
           <AlertTriangle className="text-blue-400 shrink-0" size={20} />
           <div>
             <span className="font-semibold block mb-1">Important Rule</span>
             Normal user accounts cannot send inline buttons. The link is sent as clickable markdown text. The bot automatically limits messages (5 users/20 mins).
           </div>
        </div>

        {/* Main Content */}
        {!status?.isConnected && step !== 3 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md mx-auto mt-12">
            <h2 className="text-lg font-medium mb-4 flex items-center justify-between">
              Connect Account
              <div className="flex bg-gray-950 rounded-lg p-1">
                 <button onClick={() => setLoginMethod('phone')} className={`px-3 py-1 text-xs rounded-md ${loginMethod==='phone'?'bg-blue-600 text-white':'text-gray-400 font-medium hover:text-white'}`}>Phone</button>
                 <button onClick={() => setLoginMethod('session')} className={`px-3 py-1 text-xs rounded-md ${loginMethod==='session'?'bg-blue-600 text-white':'text-gray-400 font-medium hover:text-white'}`}>Session String</button>
              </div>
            </h2>
            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-md">{error}</div>}
            
            {loginMethod === 'phone' ? (
              <>
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Phone Number (with country code)</label>
                      <input 
                        type="text" 
                        placeholder="+919876543210"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <button 
                      onClick={handleSendCode} 
                      disabled={loading || !phone}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md transition flex justify-center"
                    >
                      {loading ? 'Sending...' : 'Send Login Code'}
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Login Code from Telegram app</label>
                      <input 
                        type="text" 
                        placeholder="12345"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <button 
                      onClick={handleLogin} 
                      disabled={loading || !code}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md transition flex justify-center"
                    >
                      {loading ? 'Connecting...' : 'Login & Start Bot'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Session String</label>
                  <input 
                    type="password" 
                    placeholder="Enter your Session String..."
                    value={sessionInput}
                    onChange={e => setSessionInput(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 outline-none focus:border-blue-500 transition font-mono text-xs"
                  />
                </div>
                <button 
                  onClick={handleSessionLogin} 
                  disabled={loading || !sessionInput}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md transition flex justify-center"
                >
                  {loading ? 'Connecting...' : 'Login with Session String'}
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Use this if your server restarted to login without OTP.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Sidebar Controls */}
            <div className="space-y-4 lg:col-span-1">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold text-lg mb-4 flex items-center justify-between">
                  Status
                  <div className={`w-3 h-3 rounded-full ${status?.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </h3>
                
                <div className="mb-6">
                  {status?.isBotActive ? (
                    <button 
                      onClick={() => toggleBot(false)}
                      className="w-full py-3 rounded-lg font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center gap-2 border border-red-500/20 transition"
                    >
                      <Power size={18} /> Stop Bot
                    </button>
                  ) : (
                    <button 
                      onClick={() => toggleBot(true)}
                      className="w-full py-3 rounded-lg font-medium bg-green-500 text-gray-950 hover:bg-green-400 flex items-center justify-center gap-2 transition shadow-lg shadow-green-500/20"
                    >
                      <Power size={18} /> Start Bot
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                   <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                     <div className="text-gray-400 text-xs uppercase mb-1 flex items-center gap-1"><Send size={12}/> Total Messaged</div>
                     <div className="text-2xl font-mono">{status?.totalMessaged || 0}</div>
                   </div>
                   
                   <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                     <div className="text-gray-400 text-xs uppercase mb-1 flex items-center gap-1"><Activity size={12}/> Rate Limit (Window)</div>
                     <div className="text-xl font-mono">{status?.messagesSentCurrentWindow || 0} / {status?.rateLimitUsers || rateLimitUsers}</div>
                   </div>

                   {cooldownActive && (
                     <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-amber-500">
                       <div className="text-xs uppercase mb-1 font-bold">Cooldown Active</div>
                       <div className="text-sm">Sleeping for ~{cooldownRemaining} minutes</div>
                     </div>
                   )}
                </div>

                {status?.isConnected && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                     <h4 className="text-xs uppercase text-gray-500 font-bold mb-2 flex items-center gap-1"><Key size={12}/> Backup Session String</h4>
                     <p className="text-xs text-gray-400 mb-2 leading-relaxed">Save this string safely. If the server restarts or goes to sleep, use this to login directly without an OTP code.</p>
                     <div className="flex gap-2">
                       <input 
                         type="password" 
                         value={status?.sessionString || ''} 
                         readOnly 
                         className="bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-400 w-full outline-none" 
                       />
                       <button 
                         onClick={() => { 
                           navigator.clipboard.writeText(status?.sessionString || ''); 
                           setCopiedInfo('Copied!'); 
                           setTimeout(()=>setCopiedInfo(''), 2000); 
                         }} 
                         className="bg-gray-800 hover:bg-gray-700 p-2 rounded text-gray-300 transition shrink-0" 
                         title="Copy Session String"
                       >
                         <Copy size={16}/>
                       </button>
                     </div>
                     {copiedInfo && <div className="text-green-400 text-xs mt-2 font-medium">{copiedInfo}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Main Tabs */}
            <div className="lg:col-span-3 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
                {/* Groups List */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <h3 className="font-semibold flex items-center gap-2"><Users size={18}/> Monitor Groups</h3>
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md">{targetGroups.size} Selected</span>
                  </div>
                  <div className="p-4 bg-gray-900/30 text-sm text-gray-400 border-b border-gray-800">
                    If no groups are selected, the bot will monitor all groups you are in. Select groups to restrict it.
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {groups.length === 0 && <div className="p-4 text-center text-gray-500">Loading groups...</div>}
                    {groups.map(group => {
                      const isSelected = targetGroups.has(group.id) || targetGroups.has('-100' + group.id);
                      return (
                        <div 
                          key={group.id} 
                          onClick={() => toggleGroup(group.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition select-none ${isSelected ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-gray-800 border border-transparent'}`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-gray-900"
                          />
                          <span className="truncate flex-1 font-medium">{group.title}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Live Logs */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-gray-800 bg-gray-900/50">
                    <h3 className="font-semibold flex items-center gap-2"><Settings size={18}/> Live Logs</h3>
                  </div>
                  <div className="p-4 bg-gray-950 flex-1 overflow-y-auto font-mono text-sm space-y-2">
                    {status?.logs?.length ? (
                      status.logs.map((log: string, idx: number) => {
                        const isError = log.toLowerCase().includes('error');
                        const isSuccess = log.includes('Sent DM');
                        return (
                          <div key={idx} className={`break-all pb-1 ${isError ? 'text-red-400' : isSuccess ? 'text-green-400' : 'text-gray-300'}`}>
                            {log}
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-gray-600 italic">Waiting for events...</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Message Customization */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                    <h3 className="font-semibold flex items-center gap-2"><MessageSquare size={18}/> Message Configuration</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Message Text</label>
                      <textarea 
                        value={msgText}
                        onChange={e => setMsgText(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 outline-none focus:border-blue-500 transition min-h-24 resize-y"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Button Text</label>
                      <input 
                        type="text" 
                        value={btnText}
                        onChange={e => setBtnText(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Button Link URL</label>
                      <input 
                        type="url" 
                        value={btnLink}
                        onChange={e => setBtnLink(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 outline-none focus:border-blue-500 transition font-mono text-sm"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-400 mb-1">Users per window limit</label>
                        <input 
                          type="number" 
                          value={rateLimitUsers}
                          onChange={e => setRateLimitUsers(Number(e.target.value))}
                          className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 outline-none focus:border-blue-500 transition"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-gray-400 mb-1">Cooldown time (minutes)</label>
                        <input 
                          type="number" 
                          value={rateLimitWindowMinutes}
                          onChange={e => setRateLimitWindowMinutes(Number(e.target.value))}
                          className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 outline-none focus:border-blue-500 transition"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={saveMessageSettings}
                      disabled={isSavingMessage}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md transition flex items-center justify-center gap-2"
                    >
                      <Save size={16} /> {isSavingMessage ? 'Saving...' : 'Save Message'}
                    </button>
                    <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-sm mt-4">
                      <span className="text-gray-500 text-xs uppercase mb-2 block font-bold">Preview</span>
                      <div className="whitespace-pre-wrap">{msgText}</div>
                      <div className="mt-2 text-blue-400">{btnText}</div>
                    </div>
                  </div>
                </div>

                {/* History Table */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                    <h3 className="font-semibold flex items-center gap-2"><History size={18}/> Message History</h3>
                    <button onClick={fetchHistory} className="text-xs text-gray-400 hover:text-white transition">Refresh</button>
                  </div>
                  <div className="h-[432px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 sticky top-0">
                        <tr>
                          <th className="px-6 py-3">Time</th>
                          <th className="px-6 py-3">User ID</th>
                          <th className="px-6 py-3">Group ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-4 text-center text-gray-500 italic">No messages sent yet.</td>
                          </tr>
                        ) : (
                          history.map((h, i) => (
                            <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                              <td className="px-6 py-3 text-gray-400">{new Date(h.timestamp).toLocaleString()}</td>
                              <td className="px-6 py-3 font-mono text-blue-400">{h.userId}</td>
                              <td className="px-6 py-3 font-mono text-gray-500">{h.groupId}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}


