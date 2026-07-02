const { useState, useEffect, useRef } = React;

function App() {
    // State management
    const [activeTab, setActiveTab] = useState("dashboard");
    const [ticker, setTicker] = useState("AAPL");
    const [tickerInput, setTickerInput] = useState("AAPL");
    const [companyInfo, setCompanyInfo] = useState(null);
    const [history, setHistory] = useState([]);
    const [statements, setStatements] = useState(null);
    const [ratios, setRatios] = useState([]);
    const [news, setNews] = useState([]);
    const [transcripts, setTranscripts] = useState([]);
    
    // API Keys and Settings
    const [apiKeys, setApiKeys] = useState({ openai_key: "", gemini_key: "", default_ticker: "AAPL" });
    const [saveStatus, setSaveStatus] = useState("");

    // Loading states
    const [loadingCompany, setLoadingCompany] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingNews, setLoadingNews] = useState(false);
    
    // Tab-specific states
    // RAG
    const [ragQuery, setRagQuery] = useState("");
    const [ragAnswer, setRagAnswer] = useState("");
    const [ragContext, setRagContext] = useState([]);
    const [ragLoading, setRagLoading] = useState(false);

    // AI Reports
    const [aiSummary, setAiSummary] = useState(null);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
    const [aiRisks, setAiRisks] = useState(null);
    const [aiRisksLoading, setAiRisksLoading] = useState(false);
    const [aiRecommend, setAiRecommend] = useState(null);
    const [aiRecommendLoading, setAiRecommendLoading] = useState(false);

    // Comparison
    const [compTicker1, setCompTicker1] = useState("AAPL");
    const [compTicker2, setCompTicker2] = useState("MSFT");
    const [comparisonData, setComparisonData] = useState(null);
    const [comparisonLoading, setComparisonLoading] = useState(false);

    // Earnings Transcript Upload
    const [uploadQuarter, setUploadQuarter] = useState("Q1");
    const [uploadYear, setUploadYear] = useState(2024);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadingTranscript, setUploadingTranscript] = useState(false);
    const [selectedTranscript, setSelectedTranscript] = useState(null);
    const [transcriptAnalysis, setTranscriptAnalysis] = useState(null);
    const [loadingTranscriptAnalysis, setLoadingTranscriptAnalysis] = useState(false);

    // Chart Refs
    const priceChartRef = useRef(null);
    const indicatorChartRef = useRef(null);
    const ratioChartRef = useRef(null);
    const compareChartRef = useRef(null);
    
    const priceChartInstance = useRef(null);
    const indicatorChartInstance = useRef(null);
    const ratioChartInstance = useRef(null);
    const compareChartInstance = useRef(null);

    // Load initial settings and data
    useEffect(() => {
        // Initialize Lucide Icons
        setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 100);
        
        // Fetch Settings
        fetch("/api/auth/settings")
            .then(res => res.json())
            .then(data => {
                setApiKeys(data);
                if (data.default_ticker) {
                    setTicker(data.default_ticker);
                    setTickerInput(data.default_ticker);
                }
            })
            .catch(err => console.error("Error fetching settings:", err));
    }, []);

    // Trigger data fetch when ticker changes
    useEffect(() => {
        if (!ticker) return;
        
        setLoadingCompany(true);
        setLoadingHistory(true);
        setLoadingNews(true);
        
        // 1. Fetch Company Profile & Statements
        fetch(`/api/company/search?ticker=${ticker}`)
            .then(res => {
                if (!res.ok) throw new Error("Ticker not found");
                return res.json();
            })
            .then(data => {
                setCompanyInfo(data);
                setRatios(data.ratios || []);
                setLoadingCompany(false);
                
                // Fetch financial statements
                return fetch(`/api/financials/statements?ticker=${ticker}`);
            })
            .then(res => res.json())
            .then(data => setStatements(data))
            .catch(err => {
                console.error("Error fetching company details:", err);
                setLoadingCompany(false);
            });
            
        // 2. Fetch Historical Stock Prices
        fetch(`/api/company/history?ticker=${ticker}&period=1y`)
            .then(res => res.json())
            .then(data => {
                setHistory(data);
                setLoadingHistory(false);
            })
            .catch(err => {
                console.error("Error fetching history:", err);
                setLoadingHistory(false);
            });

        // 3. Fetch News Feed
        fetch(`/api/news?ticker=${ticker}`)
            .then(res => res.json())
            .then(data => {
                setNews(data);
                setLoadingNews(false);
            })
            .catch(err => {
                console.error("Error fetching news:", err);
                setLoadingNews(false);
            });

        // 4. Fetch Uploaded Transcripts
        fetch(`/api/earnings/list?ticker=${ticker}`)
            .then(res => res.json())
            .then(data => setTranscripts(data))
            .catch(err => console.error("Error listing transcripts:", err));

        // Reset AI summaries for the new ticker
        setAiSummary(null);
        setAiRisks(null);
        setAiRecommend(null);
        setRagAnswer("");
        setRagContext([]);
    }, [ticker]);

    // Redraw Stock Dashboard charts when history data changes
    useEffect(() => {
        if (activeTab === "dashboard" && history.length > 0 && priceChartRef.current) {
            renderDashboardCharts();
        }
        // Redraw ratio charts if in ratio tab
        if (activeTab === "ratios" && ratios.length > 0 && ratioChartRef.current) {
            renderRatioCharts();
        }
        // Redraw comparison charts if in comparison tab
        if (activeTab === "comparison" && comparisonData && compareChartRef.current) {
            renderComparisonCharts();
        }
    }, [activeTab, history, ratios, comparisonData]);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [activeTab, companyInfo, history, news, transcripts, ragLoading, aiSummary, aiRisks, aiRecommend, comparisonData, transcriptAnalysis]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (tickerInput.trim()) {
            setTicker(tickerInput.trim().toUpperCase());
        }
    };

    // Save Settings
    const handleSaveSettings = (e) => {
        e.preventDefault();
        setSaveStatus("saving");
        fetch("/api/auth/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(apiKeys)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                setSaveStatus("success");
                setTimeout(() => setSaveStatus(""), 3000);
            } else {
                setSaveStatus("error");
            }
        })
        .catch(err => {
            console.error("Failed saving settings", err);
            setSaveStatus("error");
        });
    };

    // Run RAG Search Query
    const handleRagQuery = (e) => {
        e.preventDefault();
        if (!ragQuery.trim()) return;
        
        setRagLoading(true);
        setRagAnswer("");
        setRagContext([]);
        
        fetch("/api/rag/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker: ticker, query: ragQuery })
        })
        .then(res => res.json())
        .then(data => {
            setRagAnswer(data.answer);
            setRagContext(data.retrieved_context || []);
            setRagLoading(false);
        })
        .catch(err => {
            console.error("RAG search failed", err);
            setRagAnswer("Error generating answer. Please try again.");
            setRagLoading(false);
        });
    };

    // Fetch AI Executive Summary (Module 5)
    const fetchAiSummary = () => {
        setAiSummaryLoading(true);
        fetch(`/api/analyze/summary?ticker=${ticker}`)
            .then(res => res.json())
            .then(data => {
                setAiSummary(data);
                setAiSummaryLoading(false);
            })
            .catch(err => {
                console.error(err);
                setAiSummaryLoading(false);
            });
    };

    // Fetch AI Risk Analyzer (Module 11)
    const fetchAiRisks = () => {
        setAiRisksLoading(true);
        fetch(`/api/analyze/risks?ticker=${ticker}`)
            .then(res => res.json())
            .then(data => {
                setAiRisks(data);
                setAiRisksLoading(false);
            })
            .catch(err => {
                console.error(err);
                setAiRisksLoading(false);
            });
    };

    // Fetch AI Recommendation (Module 12)
    const fetchAiRecommend = () => {
        setAiRecommendLoading(true);
        fetch(`/api/analyze/recommendation?ticker=${ticker}`)
            .then(res => res.json())
            .then(data => {
                setAiRecommend(data);
                setAiRecommendLoading(false);
            })
            .catch(err => {
                console.error(err);
                setAiRecommendLoading(false);
            });
    };

    // Run Two Company Comparison (Module 8)
    const handleCompare = (e) => {
        e.preventDefault();
        setComparisonLoading(true);
        setComparisonData(null);
        
        fetch(`/api/comparison?ticker1=${compTicker1.toUpperCase()}&ticker2=${compTicker2.toUpperCase()}`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to load comparison");
                return res.json();
            })
            .then(data => {
                setComparisonData(data);
                setComparisonLoading(false);
            })
            .catch(err => {
                console.error(err);
                alert("Error comparing companies. Make sure both tickers are valid.");
                setComparisonLoading(false);
            });
    };

    // Upload Earnings Transcript (Module 7)
    const handleUploadTranscript = (e) => {
        e.preventDefault();
        if (!uploadFile) return;
        
        setUploadingTranscript(true);
        const formData = new FormData();
        formData.append("ticker", ticker);
        formData.append("quarter", uploadQuarter);
        formData.append("year", uploadYear);
        formData.append("file", uploadFile);
        
        fetch("/api/earnings/upload", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            setUploadingTranscript(false);
            setUploadFile(null);
            // Refresh list
            fetch(`/api/earnings/list?ticker=${ticker}`)
                .then(res => res.json())
                .then(list => setTranscripts(list));
                
            // Set uploaded as selected
            loadTranscriptAnalysis(data.id);
        })
        .catch(err => {
            console.error(err);
            alert("Upload failed.");
            setUploadingTranscript(false);
        });
    };

    const loadTranscriptAnalysis = (id) => {
        setLoadingTranscriptAnalysis(true);
        setSelectedTranscript(id);
        setTranscriptAnalysis(null);
        
        fetch(`/api/earnings/analysis/${id}`)
            .then(res => res.json())
            .then(data => {
                setTranscriptAnalysis(data);
                setLoadingTranscriptAnalysis(false);
            })
            .catch(err => {
                console.error(err);
                setLoadingTranscriptAnalysis(false);
            });
    };

    // Chart.js render helpers
    const renderDashboardCharts = () => {
        if (priceChartInstance.current) priceChartInstance.current.destroy();
        if (indicatorChartInstance.current) indicatorChartInstance.current.destroy();
        
        const dates = history.map(h => h.date);
        const closes = history.map(h => h.close);
        const volumes = history.map(h => h.volume);
        
        const sma20 = history.map(h => h.sma_20);
        const sma50 = history.map(h => h.sma_50);
        const rsi = history.map(h => h.rsi);
        
        // 1. Price Line Chart with SMA
        const ctxPrice = priceChartRef.current.getContext('2d');
        priceChartInstance.current = new Chart(ctxPrice, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Close Price ($)',
                        data: closes,
                        borderColor: '#6366f1',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1,
                        fill: false
                    },
                    {
                        label: 'SMA 20',
                        data: sma20,
                        borderColor: '#06b6d4',
                        borderWidth: 1.2,
                        pointRadius: 0,
                        borderDash: [5, 5],
                        fill: false
                    },
                    {
                        label: 'SMA 50',
                        data: sma50,
                        borderColor: '#f59e0b',
                        borderWidth: 1.2,
                        pointRadius: 0,
                        borderDash: [2, 2],
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#9ca3af' } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', maxTicksLimit: 12 } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
                }
            }
        });

        // 2. Technical Indicators (RSI)
        const ctxIndicator = indicatorChartRef.current.getContext('2d');
        indicatorChartInstance.current = new Chart(ctxIndicator, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'RSI (14)',
                        data: rsi,
                        borderColor: '#a855f7',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', maxTicksLimit: 12 } },
                    y: { 
                        min: 0, 
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
                        ticks: { color: '#9ca3af' } 
                    }
                }
            }
        });
    };

    const renderRatioCharts = () => {
        if (ratioChartInstance.current) ratioChartInstance.current.destroy();
        
        // Ratios is array of {date, roe, roa, debt_equity, current_ratio...}
        // Plot ROE vs ROA trends
        const dates = [...ratios].reverse().map(r => r.date);
        const roe = [...ratios].reverse().map(r => r.roe);
        const roa = [...ratios].reverse().map(r => r.roa);
        const currentRatio = [...ratios].reverse().map(r => r.current_ratio);
        
        const ctxRatio = ratioChartRef.current.getContext('2d');
        ratioChartInstance.current = new Chart(ctxRatio, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'ROE (%)',
                        data: roe,
                        borderColor: '#ec4899',
                        borderWidth: 2,
                        pointRadius: 4,
                        tension: 0.1
                    },
                    {
                        label: 'ROA (%)',
                        data: roa,
                        borderColor: '#3b82f6',
                        borderWidth: 2,
                        pointRadius: 4,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#9ca3af' } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
                }
            }
        });
    };

    const renderComparisonCharts = () => {
        if (compareChartInstance.current) compareChartInstance.current.destroy();
        
        const comp = comparisonData;
        const name1 = comp.company1.name;
        const name2 = comp.company2.name;
        
        // Extract PE Ratio and EPS
        const pe1 = comp.company1.pe_ratio || 0.0;
        const pe2 = comp.company2.pe_ratio || 0.0;
        
        const eps1 = comp.company1.eps || 0.0;
        const eps2 = comp.company2.eps || 0.0;

        const ctxCompare = compareChartRef.current.getContext('2d');
        compareChartInstance.current = new Chart(ctxCompare, {
            type: 'bar',
            data: {
                labels: ['PE Ratio', 'EPS ($)'],
                datasets: [
                    {
                        label: name1,
                        data: [pe1, eps1],
                        backgroundColor: '#6366f1',
                        borderRadius: 6
                    },
                    {
                        label: name2,
                        data: [pe2, eps2],
                        backgroundColor: '#06b6d4',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#9ca3af' } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
                }
            }
        });
    };

    // Helper formatting functions
    const formatNumber = (num) => {
        if (!num) return "N/A";
        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        return `$${num.toLocaleString()}`;
    };

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="w-64 bg-navy-900 border-r border-white/5 flex flex-col shrink-0">
                {/* Logo Section */}
                <div className="p-6 border-b border-white/5 flex items-center space-x-3 bg-brand-950/20">
                    <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center glow-indigo">
                        <i data-lucide="trending-up" className="h-5 w-5 text-white"></i>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white tracking-wider uppercase leading-none">FinAssistant</h1>
                        <span className="text-[10px] text-indigo-400 font-semibold tracking-widest uppercase">AI Research Node</span>
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {[
                        { id: "dashboard", label: "Stock Dashboard", icon: "activity" },
                        { id: "statements", label: "Financial Statements", icon: "file-text" },
                        { id: "ratios", label: "Financial Ratios", icon: "pie-chart" },
                        { id: "rag", label: "SEC filing RAG", icon: "search" },
                        { id: "reports", label: "Research Summaries", icon: "layers" },
                        { id: "risks", label: "Risk Analyzer", icon: "alert-triangle" },
                        { id: "recommendation", label: "Investment Recommendation", icon: "award" },
                        { id: "news", label: "News & Sentiment", icon: "globe" },
                        { id: "earnings", label: "Earnings Transcript", icon: "mic" },
                        { id: "comparison", label: "Ticker Comparison", icon: "git-compare" },
                        { id: "settings", label: "API Keys & Config", icon: "settings" }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? "bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 shadow-sm shadow-indigo-500/5"
                                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                            }`}
                        >
                            <i data-lucide={tab.icon} className="h-4 w-4"></i>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-navy-950">
                {/* Header */}
                <header className="h-20 bg-navy-900/60 border-b border-white/5 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-40">
                    <form onSubmit={handleSearch} className="flex items-center space-x-2 w-96">
                        <div className="relative w-full">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                                <i data-lucide="search" className="h-4 w-4"></i>
                            </span>
                            <input
                                type="text"
                                value={tickerInput}
                                onChange={(e) => setTickerInput(e.target.value)}
                                placeholder="Enter ticker symbol (e.g., AAPL, TSLA, NVDA)..."
                                className="w-full bg-navy-950 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all shadow-md shadow-indigo-600/10 shrink-0"
                        >
                            Search
                        </button>
                    </form>

                    {/* Quick Profile Summary */}
                    {companyInfo && (
                        <div className="flex items-center space-x-6 text-sm">
                            <div className="border-r border-white/10 pr-6">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Active Ticker</div>
                                <div className="text-base font-bold text-white">{companyInfo.name} ({companyInfo.ticker})</div>
                            </div>
                            <div className="border-r border-white/10 pr-6">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Market Price</div>
                                <div className="text-base font-bold text-emerald-400 font-mono">${companyInfo.price?.toFixed(2)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Market Cap</div>
                                <div className="text-base font-bold text-white font-mono">{formatNumber(companyInfo.market_cap)}</div>
                            </div>
                        </div>
                    )}
                </header>

                {/* Content Container */}
                <div className="flex-1 p-8 overflow-y-auto">
                    {loadingCompany ? (
                        <div className="flex flex-col items-center justify-center h-96 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                            <p className="text-gray-400 text-sm">Analyzing market channels and compiling statement models...</p>
                        </div>
                    ) : (
                        <div className="fade-in space-y-6">
                            {/* Stock Dashboard Tab */}
                            {activeTab === "dashboard" && companyInfo && (
                                <div className="space-y-6">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <div className="glass-card p-6 rounded-xl space-y-2 glow-indigo">
                                            <div className="flex items-center justify-between text-gray-400">
                                                <span className="text-xs font-semibold uppercase tracking-wider">Sector</span>
                                                <i data-lucide="tag" className="h-4 w-4 text-indigo-400"></i>
                                            </div>
                                            <div className="text-lg font-bold text-white">{companyInfo.sector}</div>
                                            <div className="text-xs text-gray-500">{companyInfo.industry}</div>
                                        </div>

                                        <div className="glass-card p-6 rounded-xl space-y-2">
                                            <div className="flex items-center justify-between text-gray-400">
                                                <span className="text-xs font-semibold uppercase tracking-wider">CEO</span>
                                                <i data-lucide="user" className="h-4 w-4 text-indigo-400"></i>
                                            </div>
                                            <div className="text-lg font-bold text-white">{companyInfo.ceo}</div>
                                            <div className="text-xs text-gray-500">Chief Executive Officer</div>
                                        </div>

                                        <div className="glass-card p-6 rounded-xl space-y-2">
                                            <div className="flex items-center justify-between text-gray-400">
                                                <span className="text-xs font-semibold uppercase tracking-wider">P/E Ratio</span>
                                                <i data-lucide="percent" className="h-4 w-4 text-indigo-400"></i>
                                            </div>
                                            <div className="text-lg font-bold text-white font-mono">{companyInfo.pe_ratio ? companyInfo.pe_ratio.toFixed(2) : "N/A"}</div>
                                            <div className="text-xs text-gray-500">Trailing Twelve Months</div>
                                        </div>

                                        <div className="glass-card p-6 rounded-xl space-y-2">
                                            <div className="flex items-center justify-between text-gray-400">
                                                <span className="text-xs font-semibold uppercase tracking-wider">Earnings Per Share</span>
                                                <i data-lucide="coins" className="h-4 w-4 text-indigo-400"></i>
                                            </div>
                                            <div className="text-lg font-bold text-white font-mono">${companyInfo.eps?.toFixed(2)}</div>
                                            <div className="text-xs text-gray-500">Basic EPS</div>
                                        </div>
                                    </div>

                                    {/* Description and Charts */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="lg:col-span-2 glass-card p-6 rounded-xl space-y-4">
                                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">1-Year Stock Price History & SMA</h3>
                                            <div className="h-96 relative">
                                                {loadingHistory ? (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                                    </div>
                                                ) : (
                                                    <canvas ref={priceChartRef}></canvas>
                                                )}
                                            </div>
                                        </div>

                                        <div className="glass-card p-6 rounded-xl space-y-4">
                                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Business Summary</h3>
                                            <p className="text-gray-400 text-xs leading-relaxed overflow-y-auto h-96 pr-2">
                                                {companyInfo.summary}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Indicators and Stats */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="glass-card p-6 rounded-xl space-y-4">
                                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Relative Strength Index (RSI 14)</h3>
                                            <div className="h-32 relative">
                                                <canvas ref={indicatorChartRef}></canvas>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2 glass-card p-6 rounded-xl space-y-4">
                                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Key Stock Stats</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                <div className="bg-navy-950 p-4 rounded-lg border border-white/5 text-center">
                                                    <span className="text-gray-500 block mb-1">52-Week High</span>
                                                    <span className="font-bold text-white font-mono">${companyInfo.fifty_two_week_high?.toFixed(2)}</span>
                                                </div>
                                                <div className="bg-navy-950 p-4 rounded-lg border border-white/5 text-center">
                                                    <span className="text-gray-500 block mb-1">52-Week Low</span>
                                                    <span className="font-bold text-white font-mono">${companyInfo.fifty_two_week_low?.toFixed(2)}</span>
                                                </div>
                                                <div className="bg-navy-950 p-4 rounded-lg border border-white/5 text-center">
                                                    <span className="text-gray-500 block mb-1">Volume</span>
                                                    <span className="font-bold text-white font-mono">{companyInfo.volume?.toLocaleString()}</span>
                                                </div>
                                                <div className="bg-navy-950 p-4 rounded-lg border border-white/5 text-center">
                                                    <span className="text-gray-500 block mb-1">Avg Volume</span>
                                                    <span className="font-bold text-white font-mono">{companyInfo.average_volume?.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Financial Statements Tab */}
                            {activeTab === "statements" && statements && (
                                <div className="glass-card p-6 rounded-xl space-y-6">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                        <h3 className="text-base font-semibold text-white">Financial Statement Viewer</h3>
                                    </div>
                                    
                                    {/* Render Statements table */}
                                    {statements.income_statement_annual && statements.income_statement_annual.length > 0 ? (
                                        <div className="space-y-8">
                                            <div>
                                                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Annual Income Statement Extract</h4>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-white/10 text-gray-400">
                                                                <th className="py-3 px-4 font-semibold">Financial Metric</th>
                                                                {Object.keys(statements.income_statement_annual[0]).filter(k => k !== "metric").map(date => (
                                                                    <th key={date} className="py-3 px-4 font-mono font-semibold">{date}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {statements.income_statement_annual.slice(0, 10).map((row, idx) => (
                                                                <tr key={idx} className="hover:bg-white/5">
                                                                    <td className="py-3 px-4 text-gray-200 font-semibold">{row.metric}</td>
                                                                    {Object.keys(row).filter(k => k !== "metric").map(date => (
                                                                        <td key={date} className="py-3 px-4 text-gray-400 font-mono">
                                                                            {row[date] !== null ? (typeof row[date] === 'number' ? row[date].toLocaleString() : row[date]) : "-"}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">Annual Balance Sheet Extract</h4>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-white/10 text-gray-400">
                                                                <th className="py-3 px-4 font-semibold">Financial Metric</th>
                                                                {Object.keys(statements.balance_sheet_annual[0]).filter(k => k !== "metric").map(date => (
                                                                    <th key={date} className="py-3 px-4 font-mono font-semibold">{date}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {statements.balance_sheet_annual.slice(0, 10).map((row, idx) => (
                                                                <tr key={idx} className="hover:bg-white/5">
                                                                    <td className="py-3 px-4 text-gray-200 font-semibold">{row.metric}</td>
                                                                    {Object.keys(row).filter(k => k !== "metric").map(date => (
                                                                        <td key={date} className="py-3 px-4 text-gray-400 font-mono">
                                                                            {row[date] !== null ? (typeof row[date] === 'number' ? row[date].toLocaleString() : row[date]) : "-"}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 text-sm">No historical financial statement data available.</p>
                                    )}
                                </div>
                            )}

                            {/* Ratios Tab */}
                            {activeTab === "ratios" && ratios.length > 0 && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Chart Trend */}
                                        <div className="lg:col-span-2 glass-card p-6 rounded-xl space-y-4">
                                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Return on Capital Trends (ROE & ROA)</h3>
                                            <div className="h-80 relative">
                                                <canvas ref={ratioChartRef}></canvas>
                                            </div>
                                        </div>

                                        {/* Latest Ratio values */}
                                        <div className="glass-card p-6 rounded-xl space-y-4">
                                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Latest Ratios (FY {ratios[0]?.date})</h3>
                                            <div className="space-y-4 text-xs">
                                                {[
                                                    { label: "Current Ratio", val: ratios[0]?.current_ratio, desc: "Liquidity benchmark" },
                                                    { label: "Quick Ratio", val: ratios[0]?.quick_ratio, desc: "Acid test liquidity" },
                                                    { label: "Debt to Equity", val: ratios[0]?.debt_equity, desc: "Capital leverage" },
                                                    { label: "Return on Equity (ROE)", val: ratios[0]?.roe ? `${ratios[0].roe}%` : "N/A", desc: "Equity efficiency" },
                                                    { label: "Return on Assets (ROA)", val: ratios[0]?.roa ? `${ratios[0].roa}%` : "N/A", desc: "Asset productivity" },
                                                    { label: "Net Profit Margin", val: ratios[0]?.net_margin ? `${ratios[0].net_margin}%` : "N/A", desc: "Bottom-line conversion" },
                                                    { label: "Operating Margin", val: ratios[0]?.operating_margin ? `${ratios[0].operating_margin}%` : "N/A", desc: "Operational efficiency" }
                                                ].map((r, i) => (
                                                    <div key={i} className="flex justify-between items-center py-2 border-b border-white/5">
                                                        <div>
                                                            <span className="font-semibold text-white block">{r.label}</span>
                                                            <span className="text-[10px] text-gray-500">{r.desc}</span>
                                                        </div>
                                                        <span className="font-mono font-bold text-indigo-400 text-sm">{r.val !== null ? r.val : "N/A"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* All years ratios */}
                                    <div className="glass-card p-6 rounded-xl">
                                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Historical Financial Ratios Table</h3>
                                        <div className="overflow-x-auto text-xs">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-white/10 text-gray-400">
                                                        <th className="py-3 px-4 font-semibold">Fiscal Period</th>
                                                        <th className="py-3 px-4 font-semibold">Current Ratio</th>
                                                        <th className="py-3 px-4 font-semibold">Quick Ratio</th>
                                                        <th className="py-3 px-4 font-semibold">Debt / Equity</th>
                                                        <th className="py-3 px-4 font-semibold">ROE (%)</th>
                                                        <th className="py-3 px-4 font-semibold">ROA (%)</th>
                                                        <th className="py-3 px-4 font-semibold">Net Margin (%)</th>
                                                        <th className="py-3 px-4 font-semibold">Operating Margin (%)</th>
                                                        <th className="py-3 px-4 font-semibold">EBITDA Margin (%)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300">
                                                    {ratios.map((r, i) => (
                                                        <tr key={i} className="hover:bg-white/5 font-mono">
                                                            <td className="py-3 px-4 font-semibold text-white">{r.date}</td>
                                                            <td className="py-3 px-4">{r.current_ratio !== null ? r.current_ratio : "N/A"}</td>
                                                            <td className="py-3 px-4">{r.quick_ratio !== null ? r.quick_ratio : "N/A"}</td>
                                                            <td className="py-3 px-4">{r.debt_equity !== null ? r.debt_equity : "N/A"}</td>
                                                            <td className="py-3 px-4 text-emerald-400">{r.roe !== null ? `${r.roe}%` : "N/A"}</td>
                                                            <td className="py-3 px-4 text-emerald-400">{r.roa !== null ? `${r.roa}%` : "N/A"}</td>
                                                            <td className="py-3 px-4">{r.net_margin !== null ? `${r.net_margin}%` : "N/A"}</td>
                                                            <td className="py-3 px-4">{r.operating_margin !== null ? `${r.operating_margin}%` : "N/A"}</td>
                                                            <td className="py-3 px-4">{r.ebitda_margin !== null ? `${r.ebitda_margin}%` : "N/A"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* RAG Engine Q&A Tab */}
                            {activeTab === "rag" && (
                                <div className="space-y-6">
                                    <div className="glass-card p-6 rounded-xl space-y-4">
                                        <div className="flex items-center space-x-3 text-indigo-400">
                                            <i data-lucide="search" className="h-5 w-5"></i>
                                            <h3 className="text-base font-bold text-white">Ask Financial Questions via SEC RAG</h3>
                                        </div>
                                        <p className="text-gray-400 text-xs">
                                            Ask specific questions about business operations, litigation risks, research spending, or capital forecasts. 
                                            The system automatically fetches and indices {ticker}'s latest 10-K filings, finds matching segments, 
                                            and uses artificial intelligence to generate an answer.
                                        </p>
                                        
                                        <form onSubmit={handleRagQuery} className="flex space-x-2">
                                            <input
                                                type="text"
                                                value={ragQuery}
                                                onChange={(e) => setRagQuery(e.target.value)}
                                                placeholder="e.g., What are the company's biggest supply chain risk factors? or Why did margins decrease?"
                                                className="flex-1 bg-navy-950 border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                                            />
                                            <button
                                                type="submit"
                                                disabled={ragLoading}
                                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-all shrink-0"
                                            >
                                                {ragLoading ? "Analyzing Chunks..." : "Ask Analyst"}
                                            </button>
                                        </form>
                                    </div>

                                    {ragAnswer && (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* AI Answer */}
                                            <div className="lg:col-span-2 glass-card p-6 rounded-xl space-y-4">
                                                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">AI Generated Answer</h4>
                                                <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                                                    {ragAnswer}
                                                </div>
                                            </div>

                                            {/* Cited Chunks */}
                                            <div className="glass-card p-6 rounded-xl space-y-4">
                                                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Cited SEC Filing Segments</h4>
                                                <div className="space-y-4 overflow-y-auto max-h-96 pr-2">
                                                    {ragContext.map((c, i) => (
                                                        <div key={i} className="bg-navy-950 p-4 rounded-lg border border-white/5 space-y-2">
                                                            <span className="text-[10px] text-gray-500 font-semibold block">{c.source_name} (Chunk #{c.chunk_index})</span>
                                                            <p className="text-gray-400 text-xs italic leading-relaxed">"{c.text}"</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Research Summaries Tab */}
                            {activeTab === "reports" && (
                                <div className="space-y-6">
                                    <div className="glass-card p-6 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-bold text-white">AI Comprehensive Investment Report</h3>
                                            <p className="text-gray-400 text-xs mt-1">Generates multi-aspect summarization including profit dynamics, bullish/bearish catalysts, and future operational outlook.</p>
                                        </div>
                                        <button
                                            onClick={fetchAiSummary}
                                            disabled={aiSummaryLoading}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-3 rounded-lg transition-all"
                                        >
                                            {aiSummaryLoading ? "Analyzing Statements..." : "Generate AI Summary"}
                                        </button>
                                    </div>

                                    {aiSummary && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="glass-card p-6 rounded-xl space-y-3">
                                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Executive Summary</span>
                                                <p className="text-gray-300 text-xs leading-relaxed">{aiSummary.executive_summary}</p>
                                            </div>

                                            <div className="glass-card p-6 rounded-xl space-y-3">
                                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">Revenue & Demand Drivers</span>
                                                <p className="text-gray-300 text-xs leading-relaxed">{aiSummary.revenue_summary}</p>
                                            </div>

                                            <div className="glass-card p-6 rounded-xl space-y-3">
                                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Profit & Capital Efficiency</span>
                                                <p className="text-gray-300 text-xs leading-relaxed">{aiSummary.profit_summary}</p>
                                            </div>

                                            <div className="glass-card p-6 rounded-xl space-y-3">
                                                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Operational Risks</span>
                                                <p className="text-gray-300 text-xs leading-relaxed">{aiSummary.risk_summary}</p>
                                            </div>

                                            <div className="glass-card p-6 rounded-xl space-y-3">
                                                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">Future Guidance & Expansion</span>
                                                <p className="text-gray-300 text-xs leading-relaxed">{aiSummary.future_guidance}</p>
                                            </div>

                                            <div className="glass-card p-6 rounded-xl space-y-4">
                                                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">Market Catalysts & Sentiment</span>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-lg space-y-2">
                                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center">
                                                            <i data-lucide="trending-up" className="h-3 w-3 mr-1"></i> Bullish Indicators
                                                        </span>
                                                        <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-3">
                                                            {aiSummary.bullish_signals?.map((s, idx) => <li key={idx}>{s}</li>)}
                                                        </ul>
                                                    </div>
                                                    <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-lg space-y-2">
                                                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center">
                                                            <i data-lucide="trending-down" className="h-3 w-3 mr-1"></i> Bearish Indicators
                                                        </span>
                                                        <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-3">
                                                            {aiSummary.bearish_signals?.map((s, idx) => <li key={idx}>{s}</li>)}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Risk Analyzer Tab */}
                            {activeTab === "risks" && (
                                <div className="space-y-6">
                                    <div className="glass-card p-6 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-bold text-white">Corporate Risk Analyzer</h3>
                                            <p className="text-gray-400 text-xs mt-1">Classifies and scores risks (Litigation, Supply Chain, Geopolitical, ESG, Cybersecurity) into High/Medium/Low grades.</p>
                                        </div>
                                        <button
                                            onClick={fetchAiRisks}
                                            disabled={aiRisksLoading}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-3 rounded-lg transition-all"
                                        >
                                            {aiRisksLoading ? "Grading Risk Profiles..." : "Extract Risk Profiles"}
                                        </button>
                                    </div>

                                    {aiRisks && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {Object.entries(aiRisks).map(([key, data]) => {
                                                const lvlColors = {
                                                    "High": "bg-rose-500/10 text-rose-400 border-rose-500/20",
                                                    "Medium": "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                                    "Low": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                };
                                                return (
                                                    <div key={key} className="glass-card p-6 rounded-xl space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold text-white uppercase tracking-wider">{key.replace("_", " ")} Risk</span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${lvlColors[data.level] || 'bg-gray-500/10 text-gray-400 border-white/5'}`}>
                                                                {data.level} Severity
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-400 text-xs leading-relaxed">{data.rationale}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Investment Recommendation Tab */}
                            {activeTab === "recommendation" && (
                                <div className="space-y-6">
                                    <div className="glass-card p-6 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-bold text-white">Wall Street Recommendation Thesis</h3>
                                            <p className="text-gray-400 text-xs mt-1">Assembles a SWOT matrix, catalysts timeline, core investment thesis, and scores recommendation confidence.</p>
                                        </div>
                                        <button
                                            onClick={fetchAiRecommend}
                                            disabled={aiRecommendLoading}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-3 rounded-lg transition-all"
                                        >
                                            {aiRecommendLoading ? "Drafting Thesis..." : "Formulate Thesis"}
                                        </button>
                                    </div>

                                    {aiRecommend && (
                                        <div className="space-y-6">
                                            {/* SWOT Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                {[
                                                    { name: "Strengths", list: aiRecommend.strengths, color: "text-emerald-400 bg-emerald-500/5 border-emerald-500/10" },
                                                    { name: "Weaknesses", list: aiRecommend.weaknesses, color: "text-rose-400 bg-rose-500/5 border-rose-500/10" },
                                                    { name: "Opportunities", list: aiRecommend.opportunities, color: "text-cyan-400 bg-cyan-500/5 border-cyan-500/10" },
                                                    { name: "Threats", list: aiRecommend.threats, color: "text-amber-400 bg-amber-500/5 border-amber-500/10" }
                                                ].map((sw, idx) => (
                                                    <div key={idx} className={`p-5 rounded-xl border ${sw.color} space-y-3`}>
                                                        <span className="text-xs font-bold uppercase tracking-wider block">{sw.name}</span>
                                                        <ul className="text-[11px] space-y-1 list-disc pl-3 text-gray-400">
                                                            {sw.list?.map((s, idx) => <li key={idx}>{s}</li>)}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Thesis and Catalysts */}
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                <div className="lg:col-span-2 glass-card p-6 rounded-xl space-y-4">
                                                    <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">Core Investment Thesis</h4>
                                                    <p className="text-gray-300 text-xs leading-relaxed">{aiRecommend.thesis}</p>
                                                </div>

                                                <div className="glass-card p-6 rounded-xl space-y-4">
                                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Analysis Confidence</h4>
                                                        <span className="font-mono font-bold text-indigo-400">{aiRecommend.confidence}%</span>
                                                    </div>
                                                    <div className="w-full bg-navy-950 rounded-full h-3 overflow-hidden border border-white/5">
                                                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${aiRecommend.confidence}%` }}></div>
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 leading-normal space-y-2 pt-2">
                                                        <span className="font-semibold text-gray-400 block">Identified Catalysts:</span>
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            {aiRecommend.catalysts?.map((c, idx) => <li key={idx}>{c}</li>)}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* News and Sentiment Tab */}
                            {activeTab === "news" && (
                                <div className="space-y-6">
                                    <h3 className="text-base font-bold text-white">Aggregated Real-time News Feed & Sentiment</h3>
                                    <div className="grid grid-cols-1 gap-6">
                                        {news.map((item, idx) => {
                                            const labelColors = {
                                                "Bullish": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                                "Bearish": "bg-rose-500/10 text-rose-400 border-rose-500/20",
                                                "Neutral": "bg-gray-500/10 text-gray-400 border-white/5"
                                            };
                                            return (
                                                <div key={idx} className="glass-card p-6 rounded-xl space-y-4 hover:border-indigo-500/20 transition-all">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-white hover:text-indigo-400 transition-all flex items-center">
                                                                {item.title} <i data-lucide="external-link" className="h-3 w-3 ml-2 text-gray-500"></i>
                                                            </a>
                                                            <span className="text-[10px] text-gray-500 font-semibold block mt-1">{item.source} • {item.published_date}</span>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${labelColors[item.sentiment_label]}`}>
                                                            {item.sentiment_label} ({item.sentiment_score})
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-400 text-xs leading-relaxed">{item.summary}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Earnings Call Transcript Analyzer */}
                            {activeTab === "earnings" && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Upload and list */}
                                    <div className="glass-card p-6 rounded-xl space-y-6 self-start">
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Upload Transcript</h3>
                                            <p className="text-gray-500 text-[11px]">Upload plain text earnings call transcripts for analysis.</p>
                                        </div>
                                        
                                        <form onSubmit={handleUploadTranscript} className="space-y-4 text-xs">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-gray-400">Quarter</label>
                                                    <select value={uploadQuarter} onChange={(e) => setUploadQuarter(e.target.value)} className="w-full bg-navy-950 border border-white/10 rounded-lg p-2 focus:outline-none">
                                                        <option value="Q1">Q1</option>
                                                        <option value="Q2">Q2</option>
                                                        <option value="Q3">Q3</option>
                                                        <option value="Q4">Q4</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-gray-400">Fiscal Year</label>
                                                    <input type="number" value={uploadYear} onChange={(e) => setUploadYear(parseInt(e.target.value))} className="w-full bg-navy-950 border border-white/10 rounded-lg p-2 focus:outline-none" />
                                                </div>
                                            </div>

                                            <div className="border border-dashed border-white/15 rounded-lg p-6 text-center space-y-2 hover:border-indigo-500/40 transition-all relative">
                                                <input
                                                    type="file"
                                                    accept=".txt"
                                                    onChange={(e) => setUploadFile(e.target.files[0])}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                                <i data-lucide="upload-cloud" className="h-8 w-8 text-gray-500 mx-auto"></i>
                                                <span className="text-[11px] text-gray-400 block font-semibold">
                                                    {uploadFile ? uploadFile.name : "Drag & drop or click to upload text file"}
                                                </span>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={uploadingTranscript || !uploadFile}
                                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/30 text-white font-semibold py-2.5 rounded-lg transition-all"
                                            >
                                                {uploadingTranscript ? "Analyzing Content..." : "Process Transcript"}
                                            </button>
                                        </form>

                                        <div className="border-t border-white/5 pt-4 space-y-3">
                                            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Transcript History</h4>
                                            {transcripts.length === 0 ? (
                                                <span className="text-gray-500 text-[11px] block">No transcripts uploaded yet.</span>
                                            ) : (
                                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                                                    {transcripts.map((t, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => loadTranscriptAnalysis(t.id)}
                                                            className={`w-full text-left p-2.5 rounded-lg border text-[11px] block transition-all ${
                                                                selectedTranscript === t.id
                                                                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20'
                                                                    : 'bg-navy-950 border-white/5 hover:bg-white/5 text-gray-400'
                                                            }`}
                                                        >
                                                            <span className="font-bold text-white block">{t.quarter} {t.year} Call</span>
                                                            <span className="text-[9px] text-gray-500">{t.filename}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="lg:col-span-2 space-y-6">
                                        {loadingTranscriptAnalysis ? (
                                            <div className="glass-card p-6 rounded-xl flex flex-col justify-center items-center h-80 space-y-3">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                                <p className="text-gray-400 text-xs">Parsing transcript comments and categorizing sentiment indices...</p>
                                            </div>
                                        ) : transcriptAnalysis ? (
                                            <div className="glass-card p-6 rounded-xl space-y-6">
                                                <div className="border-b border-white/5 pb-3">
                                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{transcriptAnalysis.quarter} {transcriptAnalysis.year} Call Analysis</h3>
                                                    <span className="text-[10px] text-gray-500">Analyzed and structured using heuristics / LLM</span>
                                                </div>

                                                <div className="space-y-4 text-xs">
                                                    <div>
                                                        <span className="font-bold text-indigo-400 uppercase tracking-widest block mb-1">CEO Commentary Summary</span>
                                                        <p className="text-gray-300 leading-relaxed bg-navy-950 p-4 rounded-lg border border-white/5">{transcriptAnalysis.analysis?.ceo_comments}</p>
                                                    </div>

                                                    <div>
                                                        <span className="font-bold text-cyan-400 uppercase tracking-widest block mb-1">CFO Commentary Summary</span>
                                                        <p className="text-gray-300 leading-relaxed bg-navy-950 p-4 rounded-lg border border-white/5">{transcriptAnalysis.analysis?.cfo_comments}</p>
                                                    </div>

                                                    <div>
                                                        <span className="font-bold text-purple-400 uppercase tracking-widest block mb-1">Guidance Outlook</span>
                                                        <p className="text-gray-300 leading-relaxed bg-navy-950 p-4 rounded-lg border border-white/5 italic">"{transcriptAnalysis.analysis?.future_guidance}"</p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-lg space-y-2">
                                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center">
                                                                Positive Highlights
                                                            </span>
                                                            <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-3">
                                                                {transcriptAnalysis.analysis?.positive_sentiment?.map((s, idx) => <li key={idx}>{s}</li>)}
                                                            </ul>
                                                        </div>
                                                        <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-lg space-y-2">
                                                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center">
                                                                Negative/Concerns
                                                            </span>
                                                            <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-3">
                                                                {transcriptAnalysis.analysis?.negative_sentiment?.map((s, idx) => <li key={idx}>{s}</li>)}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="glass-card p-6 rounded-xl flex flex-col justify-center items-center h-80 text-center space-y-2 border-dashed">
                                                <i data-lucide="mic" className="h-10 w-10 text-gray-600"></i>
                                                <span className="font-bold text-white text-sm">No Transcript Selected</span>
                                                <p className="text-gray-500 text-xs w-80">Select a transcript from history or upload a new one to view executive notes.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Ticker Comparison */}
                            {activeTab === "comparison" && (
                                <div className="space-y-6">
                                    <div className="glass-card p-6 rounded-xl">
                                        <h3 className="text-base font-bold text-white mb-4">Compare Two Stocks Side-by-side</h3>
                                        <form onSubmit={handleCompare} className="flex items-center space-x-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">First Ticker</label>
                                                <input type="text" value={compTicker1} onChange={(e) => setCompTicker1(e.target.value)} className="bg-navy-950 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-36 uppercase" />
                                            </div>
                                            <span className="text-gray-500 text-xs pt-4 font-bold">VS</span>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Second Ticker</label>
                                                <input type="text" value={compTicker2} onChange={(e) => setCompTicker2(e.target.value)} className="bg-navy-950 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-36 uppercase" />
                                            </div>
                                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-6 py-3 rounded-lg mt-4 shadow-md transition-all shrink-0">
                                                Compare Analytics
                                            </button>
                                        </form>
                                    </div>

                                    {comparisonLoading ? (
                                        <div className="flex flex-col items-center justify-center h-80 space-y-3">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                            <p className="text-gray-400 text-xs">Fetching comparatives and mapping financial metrics...</p>
                                        </div>
                                    ) : comparisonData ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Data sheet */}
                                            <div className="lg:col-span-2 glass-card p-6 rounded-xl space-y-4">
                                                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-2">Key Metric Comparison</h4>
                                                <div className="overflow-x-auto text-xs">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="border-b border-white/10 text-gray-500">
                                                                <th className="py-2">Metric Descriptor</th>
                                                                <th className="py-2 font-bold text-white">{comparisonData.company1.name} ({comparisonData.company1.ticker})</th>
                                                                <th className="py-2 font-bold text-white">{comparisonData.company2.name} ({comparisonData.company2.ticker})</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                                            <tr>
                                                                <td className="py-3 font-semibold">Stock Price</td>
                                                                <td className="py-3 font-mono text-emerald-400">${comparisonData.company1.price?.toFixed(2)}</td>
                                                                <td className="py-3 font-mono text-emerald-400">${comparisonData.company2.price?.toFixed(2)}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-3 font-semibold">Market Capitalization</td>
                                                                <td className="py-3 font-mono">{formatNumber(comparisonData.company1.market_cap)}</td>
                                                                <td className="py-3 font-mono">{formatNumber(comparisonData.company2.market_cap)}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-3 font-semibold">P/E Ratio</td>
                                                                <td className="py-3 font-mono">{comparisonData.company1.pe_ratio ? comparisonData.company1.pe_ratio.toFixed(2) : "N/A"}</td>
                                                                <td className="py-3 font-mono">{comparisonData.company2.pe_ratio ? comparisonData.company2.pe_ratio.toFixed(2) : "N/A"}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-3 font-semibold">Earnings Per Share (EPS)</td>
                                                                <td className="py-3 font-mono">${comparisonData.company1.eps?.toFixed(2)}</td>
                                                                <td className="py-3 font-mono">${comparisonData.company2.eps?.toFixed(2)}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-3 font-semibold">Sector</td>
                                                                <td className="py-3">{comparisonData.company1.sector}</td>
                                                                <td className="py-3">{comparisonData.company2.sector}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-3 font-semibold">Dividend Yield</td>
                                                                <td className="py-3 font-mono">{(comparisonData.company1.profile?.dividend_yield * 100).toFixed(2)}%</td>
                                                                <td className="py-3 font-mono">{(comparisonData.company2.profile?.dividend_yield * 100).toFixed(2)}%</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-3 font-semibold">Current Ratio (FY24)</td>
                                                                <td className="py-3 font-mono">{comparisonData.company1.ratios[0]?.current_ratio || "N/A"}</td>
                                                                <td className="py-3 font-mono">{comparisonData.company2.ratios[0]?.current_ratio || "N/A"}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-3 font-semibold">Debt to Equity (FY24)</td>
                                                                <td className="py-3 font-mono">{comparisonData.company1.ratios[0]?.debt_equity || "N/A"}</td>
                                                                <td className="py-3 font-mono">{comparisonData.company2.ratios[0]?.debt_equity || "N/A"}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-3 font-semibold">ROE (FY24)</td>
                                                                <td className="py-3 font-mono text-indigo-400">{comparisonData.company1.ratios[0]?.roe ? `${comparisonData.company1.ratios[0].roe}%` : "N/A"}</td>
                                                                <td className="py-3 font-mono text-indigo-400">{comparisonData.company2.ratios[0]?.roe ? `${comparisonData.company2.ratios[0].roe}%` : "N/A"}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Charts */}
                                            <div className="glass-card p-6 rounded-xl space-y-4">
                                                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Comparative Chart</h4>
                                                <div className="h-64 relative">
                                                    <canvas ref={compareChartRef}></canvas>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {/* Settings / API keys */}
                            {activeTab === "settings" && (
                                <div className="max-w-2xl glass-card p-6 rounded-xl space-y-6">
                                    <div className="border-b border-white/5 pb-3">
                                        <h3 className="text-base font-bold text-white">API Configurations & Keys</h3>
                                        <p className="text-gray-500 text-xs">Configure your Gemini and OpenAI API keys to enable full-fidelity AI summaries. Leaving keys blank triggers automated heuristic fallback analysis.</p>
                                    </div>
                                    
                                    <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                                        <div className="space-y-1">
                                            <label className="text-gray-400 block font-semibold">Google Gemini API Key</label>
                                            <input
                                                type="password"
                                                value={apiKeys.gemini_key}
                                                onChange={(e) => setApiKeys({ ...apiKeys, gemini_key: e.target.value })}
                                                placeholder="AIzaSy..."
                                                className="w-full bg-navy-950 border border-white/10 rounded-lg p-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-gray-400 block font-semibold">OpenAI API Key</label>
                                            <input
                                                type="password"
                                                value={apiKeys.openai_key}
                                                onChange={(e) => setApiKeys({ ...apiKeys, openai_key: e.target.value })}
                                                placeholder="sk-proj-..."
                                                className="w-full bg-navy-950 border border-white/10 rounded-lg p-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-gray-400 block font-semibold">Default Startup Ticker</label>
                                            <input
                                                type="text"
                                                value={apiKeys.default_ticker}
                                                onChange={(e) => setApiKeys({ ...apiKeys, default_ticker: e.target.value.toUpperCase() })}
                                                className="w-24 bg-navy-950 border border-white/10 rounded-lg p-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 uppercase font-mono"
                                            />
                                        </div>

                                        <div className="flex items-center space-x-4 pt-2">
                                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-all">
                                                Save Configurations
                                            </button>
                                            {saveStatus === "saving" && <span className="text-gray-400 animate-pulse">Updating Settings...</span>}
                                            {saveStatus === "success" && <span className="text-emerald-400 font-semibold">Settings Saved Successfully!</span>}
                                            {saveStatus === "error" && <span className="text-rose-400 font-semibold">Error saving configs.</span>}
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
