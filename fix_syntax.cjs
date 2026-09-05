const fs = require('fs');
const path = require('path');

const feesPortalPath = path.join(__dirname, 'src/pages/dashboard/FeesPortal.tsx');
let content = fs.readFileSync(feesPortalPath, 'utf8');

const regex = /\{\/\* STUDENT FEES PAGE \*\/\}[\s\S]*?(?=\{\/\* FEE REPORTS \*\/\}|export default function FeesPortal)/;
content = content.replace(regex, `        {/* STUDENT FEES PAGE */}
        {activeScreen === 'student_fees' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {role !== 'student' && (
              <div className="bg-white border border-slate-200/60 rounded-[24px] p-5 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
                  <div className="relative flex-1 sm:max-w-xs z-50">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                    <input 
                      type="text" 
                      value={studentFeesSearch}
                      onChange={(e) => setStudentFeesSearch(e.target.value)}
                      placeholder="Search students directory by name, roll..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 text-slate-800"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <select 
                      value={studentSearchInput}
                      onChange={(e) => setStudentSearchInput(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
                    >
                      <option value="">All Classes</option>
                      {reportClassesList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      toast.success('Exported student report to CSV!');
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>
            )}

            {!selectedStudent ? (
              <div className="bg-white border border-slate-200/60 rounded-[24px] p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-4">
                  <Users className="w-5 h-5 text-violet-600" />
                  <h3 className="text-sm font-display font-black text-slate-800 uppercase tracking-widest">Student Directory</h3>
                </div>
                {filteredStudents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedStudent(s);
                          setStudentFeesSearch('');
                        }}
                        className="p-4 bg-slate-50 hover:bg-violet-50 hover:border-violet-200 border border-slate-200 rounded-xl text-left transition-all group flex flex-col gap-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
                            {(s.name || 'S').charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-800 line-clamp-1">{s.name}</div>
                            <div className="text-[10px] font-bold text-slate-500">Roll: {s.roll_number}</div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/60">
                          <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded">Class {s.class}-{s.section}</span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <Search className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">No students found matching your search criteria.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white border border-slate-200/60 rounded-[24px] p-6 shadow-xs relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full pointer-events-none" />
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform">
                        {(selectedStudent.name || 'S').charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-display font-black text-slate-800 leading-tight">{selectedStudent.name}</h3>
                        <div className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md inline-block mt-1 border border-violet-100">
                          Class {selectedStudent.class} - {selectedStudent.section}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                  {(() => {
                    const studentFees = fees.filter(f => f.student_id === selectedStudent.id);
                    const totalBilled = studentFees.reduce((sum, f) => sum + (f.total_amount || 0), 0);
                    const totalPaid = studentFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
                    const totalDue = totalBilled - totalPaid;

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-slate-50 border border-slate-200/60 rounded-[20px] p-5 shadow-xs">
                            <h5 className="font-display font-black text-slate-800 text-xs">Total Billed</h5>
                            <span className="text-xl font-black text-slate-700 block mt-1">₹{totalBilled.toLocaleString()}</span>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-200/60 rounded-[20px] p-5 shadow-xs">
                            <h5 className="font-display font-black text-emerald-800 text-xs">Total Paid</h5>
                            <span className="text-xl font-black text-emerald-700 block mt-1">₹{totalPaid.toLocaleString()}</span>
                          </div>
                          <div className="bg-rose-50 border border-rose-200/60 rounded-[20px] p-5 shadow-xs">
                            <h5 className="font-display font-black text-rose-800 text-xs">Total Due</h5>
                            <span className="text-xl font-black text-rose-700 block mt-1">₹{totalDue.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200/60 rounded-[24px] p-6 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <h4 className="text-xs font-display font-black text-slate-700 uppercase tracking-widest">Active Fee Invoices</h4>
                            {totalDue > 0 && (
                              <button 
                                onClick={() => {
                                  setPayModalData({
                                    feeHead: 'All Dues',
                                    amount: totalDue,
                                    discount: 0,
                                    fine: 0,
                                    mode: 'cash',
                                    transactionId: '',
                                    remarks: '',
                                    status: 'paid',
                                    feeId: undefined,
                                    totalAmount: totalDue,
                                    paidAmount: totalDue,
                                    remainingAmount: 0
                                  });
                                  setIsPayModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                              >
                                Pay All Dues
                              </button>
                            )}
                          </div>
                          
                          <div className="space-y-4">
                            {studentFees.length === 0 ? (
                              <p className="text-xs text-slate-400 italic text-center py-4">No active fee invoices generated for this student.</p>
                            ) : (
                              studentFees.map((invoice, idx) => (
                                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-bold">
                                  <div>
                                    <span className="text-slate-800 block text-sm font-black">{invoice.month} {invoice.academic_year} Invoice</span>
                                    <div className="text-[10px] text-slate-500 font-medium mt-1 space-x-2">
                                      <span>Tuition: ₹{invoice.tuition_fee}</span>
                                      <span>Transport: ₹{invoice.transport_fee}</span>
                                      <span>Exam: ₹{invoice.exam_fee}</span>
                                    </div>
                                    <div className="mt-2 flex gap-2 items-center">
                                      <span className={\`px-2 py-0.5 rounded uppercase text-[9px] font-black \${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : invoice.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}\`}>
                                        {invoice.status}
                                      </span>
                                      {invoice.status !== 'pending' && <span className="text-[10px] text-slate-400">Paid on {invoice.payment_date} via {invoice.payment_mode}</span>}
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                    <div className="text-right">
                                      <span className="block text-slate-400 text-[10px] uppercase tracking-wider">Total</span>
                                      <span className="text-sm font-black text-slate-800">₹{invoice.total_amount}</span>
                                    </div>
                                    <div className="flex gap-2 w-full justify-end">
                                      {invoice.status !== 'pending' && (
                                        <button 
                                          onClick={() => {
                                            setActivePrintFee(invoice);
                                            toast.loading('Preparing print-ready receipt...', { id: 'print-generation' });
                                            setTimeout(() => {
                                              toast.success('Print dialog opened', { id: 'print-generation' });
                                              window.print();
                                            }, 600);
                                          }}
                                          className="flex-1 md:flex-none px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                        >
                                          Print Receipt
                                        </button>
                                      )}
                                      {invoice.status !== 'paid' && (
                                        <button 
                                          onClick={() => {
                                            setPayModalData({
                                              feeHead: invoice.month + ' Invoice',
                                              amount: invoice.remaining_amount,
                                              discount: 0,
                                              fine: invoice.fine_amount || 0,
                                              mode: 'cash',
                                              transactionId: '',
                                              remarks: '',
                                              status: 'paid',
                                              feeId: invoice.id,
                                              totalAmount: invoice.remaining_amount,
                                              paidAmount: invoice.remaining_amount,
                                              remainingAmount: 0
                                            });
                                            setIsPayModalOpen(true);
                                          }}
                                          className="flex-1 md:flex-none px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                        >
                                          Pay ₹{invoice.remaining_amount}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </motion.div>
        )}

`);

fs.writeFileSync(feesPortalPath, content);
console.log("Completely replaced activeScreen section with clean code!");
