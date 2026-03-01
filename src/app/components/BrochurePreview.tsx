"use client";

import React, { useRef, useState, useEffect } from "react";
import "./brochure.css"; // We'll move the trifold CSS here

export default function BrochurePreview({ data, imagePrompts }: { data: any, imagePrompts: string[] }) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const uploadTargetRef = useRef<string | null>(null);
    const [qrUrl, setQrUrl] = useState(data?.backCover?.qrCodeUrl || "");
    const [hiddenImages, setHiddenImages] = useState<Record<string, boolean>>({});

    const hideImage = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setHiddenImages(prev => ({ ...prev, [id]: true }));
    };

    useEffect(() => {
        if (data?.backCover?.qrCodeUrl) {
            setQrUrl(data.backCover.qrCodeUrl);
        }
    }, [data]);

    const handleUpdateQrCode = () => {
        const newText = window.prompt("請輸入新的醫院網址或 LINE ID (若為 LINE 官方帳號請輸入含 @ 的 ID，例如 @112jremz)：", "");
        if (newText) {
            let url = newText.trim();
            if (url.startsWith("@")) {
                url = `https://line.me/R/ti/p/${encodeURIComponent(url)}`;
            }
            setQrUrl(`https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=150`);
        }
    };

    if (!data) return null;

    // Since we don't have a mutable local state tree by default in this exact setup without some prop drilling, 
    // for a quick migration, we'll just render it. The user can edit the DOM natively with contentEditable.
    // For images, we can do a quick visual replacement using DOM if we don't want to make the whole nested object a massive React state right away.

    const triggerUpload = (targetId: string) => {
        uploadTargetRef.current = targetId;
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTargetRef.current) return;
        const url = URL.createObjectURL(file);
        const imgEl = document.getElementById(uploadTargetRef.current) as HTMLImageElement;
        if (imgEl && imgEl.tagName === 'IMG') {
            imgEl.src = url;
        } else {
            // If it was an upload area, we replace it or find the hidden img.
            const parent = document.getElementById(uploadTargetRef.current + "-container");
            if (parent) {
                parent.innerHTML = `<img src="${url}" class="content-img" style="border-radius:10px;margin:5px auto;display:block;" id="${uploadTargetRef.current}" />`;
            }
        }
    };

    return (
        <div className="brochure-container w-full overflow-x-auto bg-[#2c3e50] p-4 pb-20 rounded-xl relative print:bg-white print:p-0 print:overflow-visible">
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} />

            <div className="mb-4 bg-yellow-50 text-yellow-800 p-4 rounded-lg flex flex-col justify-between border border-yellow-200 text-sm print:hidden">
                <div className="flex items-center justify-between mb-3 border-b border-yellow-200 pb-3">
                    <div className="font-bold">⭐ AI 生成的專屬製圖指令 (Image Prompts)</div>
                    <button onClick={() => window.print()} className="bg-[#439ca6] hover:bg-[#205c6c] text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center cursor-pointer">
                        🖨️ 列印 A4 / 匯出 PDF
                    </button>
                </div>
                <ul className="list-disc pl-5 space-y-1 mb-2">
                    {imagePrompts && imagePrompts.map((p, i) => (
                        <li key={i} className="opacity-90">{p}</li>
                    ))}
                </ul>
                <div className="opacity-80 mt-2 border-t border-yellow-200 pt-2">
                    💡 網頁文字可直接點擊修改。列印時請點擊瀏覽器的 <b>「檔案」&gt;「列印」或 Cmd+P</b>，並將版面設定為 <b>A4 橫向、無邊界</b>，勾選包含背景圖片。
                </div>
            </div>

            <div id="document-container" className="brochure-doc flex flex-col items-center gap-10">

                {/* Sheet 1: 內頁 */}
                <div className="sheet">
                    {/* 內左 */}
                    <div className="panel">
                        <h2 className="section-title" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideLeft?.title || "" }} />

                        {!hiddenImages["imgLeft"] && (
                            <div id="imgLeft-container" className="my-2 cursor-pointer relative group" onClick={() => triggerUpload("imgLeft")}>
                                {data.insideLeft?.imageUrl ? (
                                    <>
                                        <img id="imgLeft" className="content-img max-h-[220px]" src={data.insideLeft.imageUrl} alt="Left" />
                                        <button onClick={(e) => hideImage(e, "imgLeft")} className="absolute top-1 right-1 print:hidden opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-opacity shadow" title="移除圖片區段">×</button>
                                    </>
                                ) : (
                                    <div className="upload-area min-h-[120px] relative">
                                        <button onClick={(e) => hideImage(e, "imgLeft")} className="absolute top-2 right-2 print:hidden opacity-0 group-hover:opacity-100 bg-white/60 hover:bg-red-500 hover:text-white text-gray-500 rounded-full w-6 h-6 flex items-center justify-center text-sm transition-all shadow-sm" title="不需要圖片，釋放空間">×</button>
                                        <div className="upload-icon">+</div>
                                        <div>上傳圖片</div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="list-container">
                            {data.insideLeft?.items?.map((item: any, i: number) => (
                                <div key={i} className="bullet-item">
                                    <h4 contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: item.title }} />
                                    <p contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: item.desc }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 內中 */}
                    <div className="panel">
                        <h2 className="section-title" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideCenter?.title || "" }} />

                        <div className="steps-container">
                            {data.insideCenter?.steps?.map((step: any, i: number) => (
                                <div key={i} className="step-item">
                                    <div className="step-icon">{i + 1}</div>
                                    <div className="step-content">
                                        <h4 contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: step.title }} />
                                        <p contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: step.desc }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-2">
                            <h4 className="text-secondary mb-1 text-[0.95rem]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideCenter?.riskTitle || "" }} />
                            <p className="text-[0.8rem] mb-1" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideCenter?.riskDesc || "" }} />

                            {data.insideCenter?.riskTable?.length > 0 && (
                                <table className="table-risk">
                                    <thead>
                                        <tr><th>分級</th><th>描述</th><th>風險</th></tr>
                                    </thead>
                                    <tbody>
                                        {data.insideCenter.riskTable.map((r: any, i: number) => (
                                            <tr key={i}>
                                                <td contentEditable suppressContentEditableWarning>{r.class}</td>
                                                <td contentEditable suppressContentEditableWarning>{r.desc}</td>
                                                <td contentEditable suppressContentEditableWarning>{r.risk}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {data.insideCenter?.infoList?.length > 0 && (
                                <div className="mt-2">
                                    {data.insideCenter.infoList.map((info: any, i: number) => (
                                        <div key={i} className="mb-[6px] text-[0.8rem] leading-[1.4]">
                                            <strong className="text-secondary" contentEditable suppressContentEditableWarning>{info.label}：</strong>
                                            <span contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: info.desc }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!hiddenImages["imgCenter"] && (
                            <div id="imgCenter-container" className="filler-image min-h-[60px] flex-1 mt-auto cursor-pointer relative overflow-hidden group" onClick={() => triggerUpload("imgCenter")}>
                                {data.insideCenter?.bottomImageUrl ? (
                                    <>
                                        <img id="imgCenter" className="content-img object-contain w-full h-full" src={data.insideCenter.bottomImageUrl} alt="Center" />
                                        <button onClick={(e) => hideImage(e, "imgCenter")} className="absolute top-1 right-1 print:hidden opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-opacity shadow" title="移除圖片區段">×</button>
                                    </>
                                ) : (
                                    <div className="upload-area h-full w-full print:hidden flex items-center justify-center relative">
                                        <button onClick={(e) => hideImage(e, "imgCenter")} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white/60 hover:bg-red-500 hover:text-white text-gray-500 rounded-full w-6 h-6 flex items-center justify-center text-sm transition-all shadow-sm z-10" title="不需要圖片，釋放空間">×</button>
                                        <div className="flex flex-col items-center">
                                            <div className="upload-icon text-[1.2rem]">+</div>
                                            <div className="text-[0.8rem]">加入圖片留白</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 內右 */}
                    <div className="panel py-[5mm]">
                        <h2 className="section-title mb-2" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideRight?.title || "" }} />
                        {data.insideRight?.subtitle && (
                            <div className="font-[800] text-secondary mb-2 text-[0.95rem]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideRight.subtitle }} />
                        )}

                        {data.insideRight?.steps?.length > 0 && (
                            <div>
                                {data.insideRight.steps.map((step: any, i: number) => (
                                    <div key={i} className="step-item mb-3">
                                        <div className="step-icon">{i + 1}</div>
                                        <div className="step-content">
                                            <h4 contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: step.title }} />
                                            <p contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: step.desc }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {data.insideRight?.sections?.length > 0 && (
                            <div>
                                {data.insideRight.sections.map((sec: any, i: number) => (
                                    <div key={i} className="mb-3">
                                        <div className="bg-secondary text-white py-1 px-2 font-bold text-[0.85rem] rounded md mb-1" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: sec.title }} />
                                        {sec.desc && <p className="text-[0.75rem] text-[#555] leading-relaxed mb-1" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: sec.desc }} />}
                                        {sec.points?.map((pt: any, j: number) => (
                                            <div key={j} className="mb-1 text-[0.8rem] leading-[1.4]">
                                                <strong className="text-secondary" contentEditable suppressContentEditableWarning>{pt.label}：</strong>
                                                <span contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: pt.text }} />
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        {data.insideRight?.doctorNote && (
                            <div className="bg-[#d85c411a] border-l-[3px] border-[#d85c41] p-2 text-[0.75rem] leading-[1.4] mt-auto" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideRight.doctorNote }} />
                        )}

                        {!hiddenImages["imgRight"] && (
                            <div id="imgRight-container" className="filler-image min-h-[60px] flex-1 cursor-pointer mt-2 relative overflow-hidden group" onClick={() => triggerUpload("imgRight")}>
                                {data.insideRight?.bottomImageUrl ? (
                                    <>
                                        <img id="imgRight" className="content-img object-contain w-full h-full" src={data.insideRight.bottomImageUrl} alt="Right" />
                                        <button onClick={(e) => hideImage(e, "imgRight")} className="absolute top-1 right-1 print:hidden opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-opacity shadow" title="移除圖片區段">×</button>
                                    </>
                                ) : (
                                    <div className="upload-area h-full w-full print:hidden flex items-center justify-center relative">
                                        <button onClick={(e) => hideImage(e, "imgRight")} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white/60 hover:bg-red-500 hover:text-white text-gray-500 rounded-full w-6 h-6 flex items-center justify-center text-sm transition-all shadow-sm z-10" title="不需要圖片，釋放空間">×</button>
                                        <div className="flex flex-col items-center">
                                            <div className="upload-icon text-[1.2rem]">+</div>
                                            <div className="text-[0.8rem]">加入圖片留白</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sheet 2: 外頁 */}
                <div className="sheet">
                    {/* 摺入頁 */}
                    <div className="panel bg-main py-[8mm]">
                        <h2 className="section-title border-[#ffffff66] mb-3 text-white" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideFlap?.title || "" }} />

                        {data.insideFlap?.aftercareSteps?.length > 0 && (
                            <div className="mb-3">
                                <h3 className="text-[1rem] mb-2 border-b border-[#ffffff4d] pb-1 text-white" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideFlap.aftercareTitle }} />
                                {data.insideFlap.aftercareSteps.map((step: any, i: number) => (
                                    <div key={i} className="flex items-start gap-2 mb-[6px]">
                                        <div className="w-4 h-4 bg-[#ffffff33] rounded-full flex items-center justify-center shrink-0 font-bold text-white text-[0.7rem] mt-[2px]">{i + 1}</div>
                                        <div>
                                            <div className="font-bold text-[0.85rem] mb-[1px] text-white" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: step.title }} />
                                            <div className="text-[0.75rem] opacity-90 leading-[1.3] text-[#ffffffeb]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: step.desc }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="red-flag mb-2 p-3 mt-auto bg-[#d85c41] text-white rounded-lg">
                            <h3 className="mb-[6px] border-b border-[#ffffff4d] pb-1 text-[0.95rem]">🚨 <span contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideFlap?.redFlagsTitle || "" }} /></h3>
                            {data.insideFlap?.redFlagsSubtitle && (
                                <p className="font-bold mb-1 text-[0.8rem]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideFlap.redFlagsSubtitle }} />
                            )}
                            <ul className="m-0 pl-5 text-[0.8rem] leading-[1.3] list-disc">
                                {data.insideFlap?.redFlagItems?.map((item: string, i: number) => (
                                    <li key={i} className="mb-[3px]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: item }} />
                                ))}
                            </ul>
                        </div>

                        {data.insideFlap?.resourceTitle && (
                            <div className="bg-[#ffffff1a] p-3 text-center mb-2 rounded-lg">
                                <h3 className="mb-2 text-[1.05rem] border-b border-[#ffffff4d] pb-1" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideFlap.resourceTitle }} />
                                <p className="text-[0.8rem] mb-2 text-[#ffffffeb]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.insideFlap.resourceDesc }} />
                                <img src={data.insideFlap.resourceQrCodeUrl} alt="QR Code" className="w-[90px] rounded-lg mx-auto" />
                            </div>
                        )}

                        {!hiddenImages["imgFlap"] && (
                            <div id="imgFlap-container" className="filler-image min-h-[60px] flex-1 mt-2 cursor-pointer relative overflow-hidden group" onClick={() => triggerUpload("imgFlap")}>
                                {data.insideFlap?.bottomImageUrl ? (
                                    <>
                                        <img id="imgFlap" className="content-img opacity-90 object-contain w-full h-full" src={data.insideFlap.bottomImageUrl} alt="Flap" />
                                        <button onClick={(e) => hideImage(e, "imgFlap")} className="absolute top-1 right-1 print:hidden opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-opacity shadow" title="移除圖片區段">×</button>
                                    </>
                                ) : (
                                    <div className="upload-area h-full w-full border-[#ffffff4d] text-white hover:bg-[#ffffff1a] hover:border-white print:hidden flex items-center justify-center relative">
                                        <button onClick={(e) => hideImage(e, "imgFlap")} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/20 hover:bg-red-500 hover:text-white text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-all shadow-sm z-10 border border-white/30" title="不需要圖片，釋放空間">×</button>
                                        <div className="flex flex-col items-center">
                                            <div className="upload-icon text-[1.2rem]">+</div>
                                            <div className="text-[0.8rem]">加入圖片留白</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 封底 */}
                    <div className="panel flex-center back-cover bg-[#f5f7f8d9]">
                        <h2 className="section-title border-transparent !border-b-0 text-[1.4rem] mb-6" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.backCover?.title || "" }} />

                        <div id="imgLogo-container" className="hospital-logo-placeholder w-[80%] max-w-[180px] mx-auto mb-6 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => triggerUpload("imgLogo")}>
                            <img id="imgLogo" src={data.backCover?.logoUrl || "logo.png"} alt="Hospital Logo" className="w-full h-auto object-contain" />
                        </div>

                        <div className="info-block text-left mb-4 text-[0.9rem] leading-[1.7] text-[#444] bg-[#ffffffcc] p-4 rounded-lg shadow-sm w-full">
                            <div className="mb-1"><strong className="mr-1 text-secondary">📍</strong> <span contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.backCover?.address || "" }} /></div>
                            <div className="mb-1"><strong className="mr-1 text-secondary">📞</strong> <span contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.backCover?.phone || "" }} /></div>
                            <div className="mb-1"><strong className="mr-1 text-secondary">💬</strong> <span contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.backCover?.line || "" }} /></div>
                            <div><strong className="mr-1 text-secondary">🌐</strong> <span contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.backCover?.website || "" }} /></div>
                        </div>

                        <div className="relative group w-fit mx-auto mt-2">
                            <img src={qrUrl || data.backCover?.qrCodeUrl} onClick={handleUpdateQrCode} className="qr-code max-w-[90px] rounded-md cursor-pointer hover:opacity-75 transition-all" alt="QR Code" title="點擊更新 QR Code" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-black/60 text-white text-[0.7rem] px-2 py-1 rounded">點擊更新</span>
                            </div>
                        </div>
                    </div>

                    {/* 封面 */}
                    <div className="panel front-cover bg-main !p-0 flex flex-col">
                        <div id="imgCover-container" className="image-container h-[50%] bg-[#ddd] border-b-[5px] border-secondary relative overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => triggerUpload("imgCover")}>
                            {data.frontCover?.image ? (
                                <img id="imgCover" src={data.frontCover.image} className="w-full h-full object-cover" alt="Cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">點擊加入封面圖</div>
                            )}
                        </div>
                        <div className="title-container text-white p-6 flex flex-col flex-1">
                            <h1 className="text-[1.5rem] leading-[1.4] mb-3 font-[900]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.frontCover?.title || "" }} />
                            <div className="subtitle text-[0.95rem] opacity-90 mb-4 leading-[1.5]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.frontCover?.subtitle || "" }} />
                            <div className="slogan mt-auto text-[1.1rem] font-bold text-center bg-[#00000026] p-2 rounded-lg tracking-[2px]" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: data.frontCover?.slogan || "" }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
