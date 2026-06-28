-- AICoS demo seed data
-- Run supabase/schema.sql first, then run this file in the Supabase SQL Editor.
-- This resets AICoS application tables and loads two quarters of realistic demo data.
-- All credentials/tokens below are fake placeholders for demo UI state only.

begin;

truncate table
  public.department_embeddings,
  public.department_snapshot_history,
  public.department_snapshots,
  public.organization_summaries,
  public.board_memos,
  public.slack_message_snapshots,
  public.slack_events,
  public.slack_installations,
  public.notion_okr_snapshots,
  public.hubspot_deal_snapshots,
  public.linear_ticket_snapshots,
  public.clickup_workspace_snapshots,
  public.jira_issue_snapshots,
  public.confluence_content_snapshots
restart identity cascade;

create temporary table demo_department_seed (
  department_id text primary key,
  department_name text not null,
  filename text not null,
  headers jsonb not null,
  records jsonb not null
) on commit drop;

insert into demo_department_seed (department_id, department_name, filename, headers, records)
values
(
  'executive',
  'Executive / Office of the CEO',
  'executive_q2_q3_demo.csv',
  '["Month","Revenue_Growth_Rate","FCF_Margin","Rule_of_40","ARR","Net_Revenue_Retention","Cash_Balance","Burn_Multiple","Strategic_Priority_Completion","Enterprise_Risk_Score"]'::jsonb,
  '[
    {"Month":"2026-04","Revenue_Growth_Rate":19,"FCF_Margin":10,"Rule_of_40":29,"ARR":7600000,"Net_Revenue_Retention":112,"Cash_Balance":5100000,"Burn_Multiple":1.8,"Strategic_Priority_Completion":68,"Enterprise_Risk_Score":3.1},
    {"Month":"2026-05","Revenue_Growth_Rate":22,"FCF_Margin":13,"Rule_of_40":35,"ARR":8050000,"Net_Revenue_Retention":115,"Cash_Balance":4890000,"Burn_Multiple":1.5,"Strategic_Priority_Completion":74,"Enterprise_Risk_Score":2.7},
    {"Month":"2026-06","Revenue_Growth_Rate":24,"FCF_Margin":18,"Rule_of_40":42,"ARR":8400000,"Net_Revenue_Retention":118,"Cash_Balance":4680000,"Burn_Multiple":1.3,"Strategic_Priority_Completion":82,"Enterprise_Risk_Score":2.1},
    {"Month":"2026-07","Revenue_Growth_Rate":26,"FCF_Margin":19,"Rule_of_40":45,"ARR":8920000,"Net_Revenue_Retention":119,"Cash_Balance":4540000,"Burn_Multiple":1.2,"Strategic_Priority_Completion":86,"Enterprise_Risk_Score":2.0},
    {"Month":"2026-08","Revenue_Growth_Rate":28,"FCF_Margin":20,"Rule_of_40":48,"ARR":9470000,"Net_Revenue_Retention":121,"Cash_Balance":4410000,"Burn_Multiple":1.1,"Strategic_Priority_Completion":88,"Enterprise_Risk_Score":1.9},
    {"Month":"2026-09","Revenue_Growth_Rate":31,"FCF_Margin":22,"Rule_of_40":53,"ARR":10150000,"Net_Revenue_Retention":123,"Cash_Balance":4320000,"Burn_Multiple":1.0,"Strategic_Priority_Completion":91,"Enterprise_Risk_Score":1.8}
  ]'::jsonb
),
(
  'finance',
  'Finance (Accounting & Treasury)',
  'finance_q2_q3_demo.csv',
  '["Month","Revenue","ARR","Revenue_Growth_Rate","Net_Revenue_Retention","COGS","Gross_Margin","Operating_Expenses","Cash_Balance","Net_New_ARR","EBITDA","Free_Cash_Flow","FCF_Margin","AR","AP","Debt"]'::jsonb,
  '[
    {"Month":"2026-04","Revenue":650000,"ARR":7600000,"Revenue_Growth_Rate":19,"Net_Revenue_Retention":112,"COGS":176000,"Gross_Margin":72.9,"Operating_Expenses":455000,"Cash_Balance":5100000,"Net_New_ARR":245000,"EBITDA":42000,"Free_Cash_Flow":61000,"FCF_Margin":9.4,"AR":690000,"AP":450000,"Debt":950000},
    {"Month":"2026-05","Revenue":690000,"ARR":8050000,"Revenue_Growth_Rate":22,"Net_Revenue_Retention":115,"COGS":184000,"Gross_Margin":73.3,"Operating_Expenses":432000,"Cash_Balance":4890000,"Net_New_ARR":282000,"EBITDA":68000,"Free_Cash_Flow":77000,"FCF_Margin":11.2,"AR":645000,"AP":438000,"Debt":925000},
    {"Month":"2026-06","Revenue":720000,"ARR":8400000,"Revenue_Growth_Rate":24,"Net_Revenue_Retention":118,"COGS":180000,"Gross_Margin":75,"Operating_Expenses":410000,"Cash_Balance":4680000,"Net_New_ARR":315000,"EBITDA":95000,"Free_Cash_Flow":82000,"FCF_Margin":11.4,"AR":610000,"AP":420000,"Debt":900000},
    {"Month":"2026-07","Revenue":770000,"ARR":8920000,"Revenue_Growth_Rate":26,"Net_Revenue_Retention":119,"COGS":188000,"Gross_Margin":75.6,"Operating_Expenses":398000,"Cash_Balance":4540000,"Net_New_ARR":350000,"EBITDA":122000,"Free_Cash_Flow":98000,"FCF_Margin":12.7,"AR":590000,"AP":405000,"Debt":875000},
    {"Month":"2026-08","Revenue":818000,"ARR":9470000,"Revenue_Growth_Rate":28,"Net_Revenue_Retention":121,"COGS":195000,"Gross_Margin":76.2,"Operating_Expenses":386000,"Cash_Balance":4410000,"Net_New_ARR":390000,"EBITDA":148000,"Free_Cash_Flow":116000,"FCF_Margin":14.2,"AR":570000,"AP":395000,"Debt":850000},
    {"Month":"2026-09","Revenue":884000,"ARR":10150000,"Revenue_Growth_Rate":31,"Net_Revenue_Retention":123,"COGS":207000,"Gross_Margin":76.6,"Operating_Expenses":372000,"Cash_Balance":4320000,"Net_New_ARR":442000,"EBITDA":184000,"Free_Cash_Flow":139000,"FCF_Margin":15.7,"AR":552000,"AP":382000,"Debt":825000}
  ]'::jsonb
),
(
  'sales',
  'Sales & Revenue Distribution',
  'sales_q2_q3_demo.csv',
  '["Month","Pipeline_Created","Qualified_Pipeline","Bookings","ARR_Won","Net_Revenue_Retention","Win_Rate","Sales_Cycle_Days","Quota_Attainment","Forecast_Commit","Churn_Risk_ARR"]'::jsonb,
  '[
    {"Month":"2026-04","Pipeline_Created":2100000,"Qualified_Pipeline":1120000,"Bookings":640000,"ARR_Won":520000,"Net_Revenue_Retention":112,"Win_Rate":23,"Sales_Cycle_Days":54,"Quota_Attainment":86,"Forecast_Commit":610000,"Churn_Risk_ARR":240000},
    {"Month":"2026-05","Pipeline_Created":2380000,"Qualified_Pipeline":1280000,"Bookings":780000,"ARR_Won":650000,"Net_Revenue_Retention":115,"Win_Rate":26,"Sales_Cycle_Days":50,"Quota_Attainment":96,"Forecast_Commit":730000,"Churn_Risk_ARR":210000},
    {"Month":"2026-06","Pipeline_Created":2600000,"Qualified_Pipeline":1420000,"Bookings":910000,"ARR_Won":760000,"Net_Revenue_Retention":118,"Win_Rate":28,"Sales_Cycle_Days":46,"Quota_Attainment":104,"Forecast_Commit":840000,"Churn_Risk_ARR":180000},
    {"Month":"2026-07","Pipeline_Created":2820000,"Qualified_Pipeline":1580000,"Bookings":1040000,"ARR_Won":870000,"Net_Revenue_Retention":119,"Win_Rate":30,"Sales_Cycle_Days":44,"Quota_Attainment":111,"Forecast_Commit":965000,"Churn_Risk_ARR":166000},
    {"Month":"2026-08","Pipeline_Created":3040000,"Qualified_Pipeline":1760000,"Bookings":1160000,"ARR_Won":980000,"Net_Revenue_Retention":121,"Win_Rate":32,"Sales_Cycle_Days":41,"Quota_Attainment":119,"Forecast_Commit":1080000,"Churn_Risk_ARR":151000},
    {"Month":"2026-09","Pipeline_Created":3310000,"Qualified_Pipeline":1990000,"Bookings":1320000,"ARR_Won":1130000,"Net_Revenue_Retention":123,"Win_Rate":34,"Sales_Cycle_Days":39,"Quota_Attainment":128,"Forecast_Commit":1240000,"Churn_Risk_ARR":136000}
  ]'::jsonb
),
(
  'marketing',
  'Marketing & Communications',
  'marketing_q2_q3_demo.csv',
  '["Month","Spend","MQL","SQL","Pipeline_Created","CAC","LTV","CAC_Payback_Months","Conversion_Rate","ROAS","Brand_Search_Index"]'::jsonb,
  '[
    {"Month":"2026-04","Spend":172000,"MQL":2860,"SQL":690,"Pipeline_Created":960000,"CAC":455,"LTV":1710,"CAC_Payback_Months":14,"Conversion_Rate":24.1,"ROAS":3.7,"Brand_Search_Index":61},
    {"Month":"2026-05","Spend":178000,"MQL":3140,"SQL":810,"Pipeline_Created":1120000,"CAC":420,"LTV":1780,"CAC_Payback_Months":12.5,"Conversion_Rate":25.8,"ROAS":4.2,"Brand_Search_Index":67},
    {"Month":"2026-06","Spend":185000,"MQL":3410,"SQL":920,"Pipeline_Created":1280000,"CAC":385,"LTV":1840,"CAC_Payback_Months":11,"Conversion_Rate":26.9,"ROAS":4.8,"Brand_Search_Index":74},
    {"Month":"2026-07","Spend":192000,"MQL":3650,"SQL":1010,"Pipeline_Created":1440000,"CAC":358,"LTV":1915,"CAC_Payback_Months":10.2,"Conversion_Rate":27.7,"ROAS":5.1,"Brand_Search_Index":79},
    {"Month":"2026-08","Spend":198000,"MQL":3910,"SQL":1130,"Pipeline_Created":1620000,"CAC":332,"LTV":1990,"CAC_Payback_Months":9.6,"Conversion_Rate":28.9,"ROAS":5.5,"Brand_Search_Index":84},
    {"Month":"2026-09","Spend":205000,"MQL":4260,"SQL":1290,"Pipeline_Created":1840000,"CAC":308,"LTV":2090,"CAC_Payback_Months":8.9,"Conversion_Rate":30.3,"ROAS":5.9,"Brand_Search_Index":91}
  ]'::jsonb
),
(
  'product',
  'Product Management & Development',
  'product_q2_q3_demo.csv',
  '["Month","Active_Users","Activation_Rate","Retention_30d","NPS","Velocity_SP","Bugs_P1","Cycle_Time_Days","Feature_Adoption","ARR_Influenced"]'::jsonb,
  '[
    {"Month":"2026-04","Active_Users":158000,"Activation_Rate":37,"Retention_30d":66,"NPS":39,"Velocity_SP":68,"Bugs_P1":6,"Cycle_Time_Days":15,"Feature_Adoption":28,"ARR_Influenced":620000},
    {"Month":"2026-05","Active_Users":171000,"Activation_Rate":40,"Retention_30d":69,"NPS":44,"Velocity_SP":76,"Bugs_P1":4,"Cycle_Time_Days":13,"Feature_Adoption":32,"ARR_Influenced":780000},
    {"Month":"2026-06","Active_Users":184000,"Activation_Rate":42,"Retention_30d":71,"NPS":48,"Velocity_SP":84,"Bugs_P1":3,"Cycle_Time_Days":11,"Feature_Adoption":36,"ARR_Influenced":940000},
    {"Month":"2026-07","Active_Users":197000,"Activation_Rate":44,"Retention_30d":73,"NPS":51,"Velocity_SP":91,"Bugs_P1":3,"Cycle_Time_Days":10,"Feature_Adoption":41,"ARR_Influenced":1080000},
    {"Month":"2026-08","Active_Users":213000,"Activation_Rate":46,"Retention_30d":75,"NPS":54,"Velocity_SP":96,"Bugs_P1":2,"Cycle_Time_Days":9,"Feature_Adoption":47,"ARR_Influenced":1260000},
    {"Month":"2026-09","Active_Users":231000,"Activation_Rate":49,"Retention_30d":78,"NPS":58,"Velocity_SP":104,"Bugs_P1":1,"Cycle_Time_Days":8,"Feature_Adoption":54,"ARR_Influenced":1480000}
  ]'::jsonb
),
(
  'customer-service',
  'Customer Service & Support',
  'customer_service_q2_q3_demo.csv',
  '["Month","Tickets_Created","Tickets_Resolved","First_Response_Minutes","Resolution_Time_Hours","CSAT","NPS","Escalation_Rate","Backlog_Tickets","Retention_Risk_Accounts"]'::jsonb,
  '[
    {"Month":"2026-04","Tickets_Created":4520,"Tickets_Resolved":4380,"First_Response_Minutes":4.8,"Resolution_Time_Hours":8.5,"CSAT":4.62,"NPS":43,"Escalation_Rate":9.4,"Backlog_Tickets":260,"Retention_Risk_Accounts":29},
    {"Month":"2026-05","Tickets_Created":4680,"Tickets_Resolved":4610,"First_Response_Minutes":3.6,"Resolution_Time_Hours":6.9,"CSAT":4.78,"NPS":48,"Escalation_Rate":7.8,"Backlog_Tickets":190,"Retention_Risk_Accounts":23},
    {"Month":"2026-06","Tickets_Created":4850,"Tickets_Resolved":4920,"First_Response_Minutes":2.4,"Resolution_Time_Hours":5.2,"CSAT":4.91,"NPS":52,"Escalation_Rate":6.8,"Backlog_Tickets":114,"Retention_Risk_Accounts":18},
    {"Month":"2026-07","Tickets_Created":5010,"Tickets_Resolved":5105,"First_Response_Minutes":2.2,"Resolution_Time_Hours":4.8,"CSAT":4.93,"NPS":55,"Escalation_Rate":6.1,"Backlog_Tickets":96,"Retention_Risk_Accounts":16},
    {"Month":"2026-08","Tickets_Created":5220,"Tickets_Resolved":5360,"First_Response_Minutes":1.9,"Resolution_Time_Hours":4.3,"CSAT":4.95,"NPS":58,"Escalation_Rate":5.5,"Backlog_Tickets":74,"Retention_Risk_Accounts":13},
    {"Month":"2026-09","Tickets_Created":5480,"Tickets_Resolved":5610,"First_Response_Minutes":1.6,"Resolution_Time_Hours":3.9,"CSAT":4.96,"NPS":61,"Escalation_Rate":4.9,"Backlog_Tickets":58,"Retention_Risk_Accounts":10}
  ]'::jsonb
),
(
  'hr',
  'Human Resources (Talent & Compensation)',
  'hr_q2_q3_demo.csv',
  '["Month","Headcount","Open_Roles","Attrition_Rate","eNPS","Revenue_per_Employee","Offer_Acceptance_Rate","Time_to_Hire_Days","Diversity_Index","Performance_Index"]'::jsonb,
  '[
    {"Month":"2026-04","Headcount":134,"Open_Roles":24,"Attrition_Rate":5.1,"eNPS":34,"Revenue_per_Employee":56716,"Offer_Acceptance_Rate":76,"Time_to_Hire_Days":39,"Diversity_Index":68,"Performance_Index":82},
    {"Month":"2026-05","Headcount":138,"Open_Roles":21,"Attrition_Rate":4.4,"eNPS":39,"Revenue_per_Employee":58333,"Offer_Acceptance_Rate":79,"Time_to_Hire_Days":35,"Diversity_Index":69,"Performance_Index":85},
    {"Month":"2026-06","Headcount":142,"Open_Roles":18,"Attrition_Rate":3.8,"eNPS":44,"Revenue_per_Employee":60845,"Offer_Acceptance_Rate":82,"Time_to_Hire_Days":31,"Diversity_Index":71,"Performance_Index":87},
    {"Month":"2026-07","Headcount":147,"Open_Roles":16,"Attrition_Rate":3.5,"eNPS":47,"Revenue_per_Employee":62610,"Offer_Acceptance_Rate":84,"Time_to_Hire_Days":29,"Diversity_Index":72,"Performance_Index":88},
    {"Month":"2026-08","Headcount":153,"Open_Roles":14,"Attrition_Rate":3.1,"eNPS":51,"Revenue_per_Employee":64180,"Offer_Acceptance_Rate":86,"Time_to_Hire_Days":27,"Diversity_Index":74,"Performance_Index":90},
    {"Month":"2026-09","Headcount":160,"Open_Roles":12,"Attrition_Rate":2.8,"eNPS":55,"Revenue_per_Employee":66520,"Offer_Acceptance_Rate":88,"Time_to_Hire_Days":25,"Diversity_Index":76,"Performance_Index":92}
  ]'::jsonb
),
(
  'operations',
  'Operations / Supply Chain',
  'operations_q2_q3_demo.csv',
  '["Month","Throughput_Units","Demand_Units","On_Time_Delivery","Inventory_Turns","Defect_Rate_PPM","Gross_Yield","Operating_Cost","Unit_Cost","Supplier_OTIF"]'::jsonb,
  '[
    {"Month":"2026-04","Throughput_Units":111000,"Demand_Units":119000,"On_Time_Delivery":95.1,"Inventory_Turns":11.8,"Defect_Rate_PPM":190,"Gross_Yield":98.4,"Operating_Cost":94000,"Unit_Cost":0.85,"Supplier_OTIF":91.2},
    {"Month":"2026-05","Throughput_Units":118000,"Demand_Units":124000,"On_Time_Delivery":96.7,"Inventory_Turns":12.7,"Defect_Rate_PPM":155,"Gross_Yield":98.8,"Operating_Cost":91500,"Unit_Cost":0.78,"Supplier_OTIF":94.1},
    {"Month":"2026-06","Throughput_Units":125000,"Demand_Units":131000,"On_Time_Delivery":98.4,"Inventory_Turns":14.2,"Defect_Rate_PPM":120,"Gross_Yield":99.1,"Operating_Cost":89000,"Unit_Cost":0.71,"Supplier_OTIF":96.8},
    {"Month":"2026-07","Throughput_Units":132000,"Demand_Units":136000,"On_Time_Delivery":98.8,"Inventory_Turns":14.8,"Defect_Rate_PPM":108,"Gross_Yield":99.2,"Operating_Cost":87500,"Unit_Cost":0.66,"Supplier_OTIF":97.2},
    {"Month":"2026-08","Throughput_Units":141000,"Demand_Units":144000,"On_Time_Delivery":99.1,"Inventory_Turns":15.6,"Defect_Rate_PPM":92,"Gross_Yield":99.4,"Operating_Cost":85800,"Unit_Cost":0.61,"Supplier_OTIF":97.9},
    {"Month":"2026-09","Throughput_Units":153000,"Demand_Units":155000,"On_Time_Delivery":99.3,"Inventory_Turns":16.4,"Defect_Rate_PPM":74,"Gross_Yield":99.5,"Operating_Cost":84200,"Unit_Cost":0.55,"Supplier_OTIF":98.4}
  ]'::jsonb
),
(
  'it',
  'Information Technology (IT) / Tech Services',
  'it_q2_q3_demo.csv',
  '["Month","Uptime_Percent","Security_Incidents","Critical_Vulnerabilities","Cloud_Spend","SaaS_Spend","MTTR_Minutes","Tickets_Resolved","Provisioning_SLA_Hours","Automation_Coverage"]'::jsonb,
  '[
    {"Month":"2026-04","Uptime_Percent":99.91,"Security_Incidents":3,"Critical_Vulnerabilities":7,"Cloud_Spend":132000,"SaaS_Spend":91000,"MTTR_Minutes":68,"Tickets_Resolved":980,"Provisioning_SLA_Hours":9,"Automation_Coverage":52},
    {"Month":"2026-05","Uptime_Percent":99.95,"Security_Incidents":2,"Critical_Vulnerabilities":4,"Cloud_Spend":128000,"SaaS_Spend":88500,"MTTR_Minutes":53,"Tickets_Resolved":1060,"Provisioning_SLA_Hours":7,"Automation_Coverage":58},
    {"Month":"2026-06","Uptime_Percent":99.98,"Security_Incidents":1,"Critical_Vulnerabilities":2,"Cloud_Spend":124000,"SaaS_Spend":86000,"MTTR_Minutes":42,"Tickets_Resolved":1180,"Provisioning_SLA_Hours":5,"Automation_Coverage":64},
    {"Month":"2026-07","Uptime_Percent":99.98,"Security_Incidents":1,"Critical_Vulnerabilities":2,"Cloud_Spend":121000,"SaaS_Spend":84200,"MTTR_Minutes":37,"Tickets_Resolved":1275,"Provisioning_SLA_Hours":4,"Automation_Coverage":69},
    {"Month":"2026-08","Uptime_Percent":99.99,"Security_Incidents":0,"Critical_Vulnerabilities":1,"Cloud_Spend":119000,"SaaS_Spend":83100,"MTTR_Minutes":31,"Tickets_Resolved":1380,"Provisioning_SLA_Hours":3,"Automation_Coverage":74},
    {"Month":"2026-09","Uptime_Percent":99.99,"Security_Incidents":0,"Critical_Vulnerabilities":1,"Cloud_Spend":116000,"SaaS_Spend":82000,"MTTR_Minutes":25,"Tickets_Resolved":1490,"Provisioning_SLA_Hours":2,"Automation_Coverage":81}
  ]'::jsonb
),
(
  'risk',
  'Risk Management & Internal Audit',
  'risk_q2_q3_demo.csv',
  '["Month","Enterprise_Risk_Score","Control_Coverage","Audit_Score","Unmitigated_Risks","Mitigated_Risks","Open_Audit_Items","Security_Findings","Operational_Loss","Compliance_Breaches"]'::jsonb,
  '[
    {"Month":"2026-04","Enterprise_Risk_Score":3.1,"Control_Coverage":88,"Audit_Score":91,"Unmitigated_Risks":7,"Mitigated_Risks":8,"Open_Audit_Items":11,"Security_Findings":6,"Operational_Loss":46000,"Compliance_Breaches":1},
    {"Month":"2026-05","Enterprise_Risk_Score":2.7,"Control_Coverage":91,"Audit_Score":94,"Unmitigated_Risks":5,"Mitigated_Risks":10,"Open_Audit_Items":7,"Security_Findings":4,"Operational_Loss":29000,"Compliance_Breaches":0},
    {"Month":"2026-06","Enterprise_Risk_Score":2.1,"Control_Coverage":94,"Audit_Score":98,"Unmitigated_Risks":3,"Mitigated_Risks":12,"Open_Audit_Items":4,"Security_Findings":2,"Operational_Loss":18000,"Compliance_Breaches":0},
    {"Month":"2026-07","Enterprise_Risk_Score":2.0,"Control_Coverage":95,"Audit_Score":98,"Unmitigated_Risks":2,"Mitigated_Risks":13,"Open_Audit_Items":3,"Security_Findings":2,"Operational_Loss":12000,"Compliance_Breaches":0},
    {"Month":"2026-08","Enterprise_Risk_Score":1.9,"Control_Coverage":96,"Audit_Score":99,"Unmitigated_Risks":2,"Mitigated_Risks":14,"Open_Audit_Items":2,"Security_Findings":1,"Operational_Loss":9000,"Compliance_Breaches":0},
    {"Month":"2026-09","Enterprise_Risk_Score":1.8,"Control_Coverage":97,"Audit_Score":99,"Unmitigated_Risks":1,"Mitigated_Risks":15,"Open_Audit_Items":1,"Security_Findings":1,"Operational_Loss":6000,"Compliance_Breaches":0}
  ]'::jsonb
),
(
  'legal',
  'Legal & Compliance',
  'legal_q2_q3_demo.csv',
  '["Month","Contracts_Executed","Contract_Cycle_Days","Compliance_Score","Open_Risk_Items","Liability_Exposure","Outside_Counsel_Spend","IP_Filings","Claims_Open","Regulatory_Actions"]'::jsonb,
  '[
    {"Month":"2026-04","Contracts_Executed":31,"Contract_Cycle_Days":28,"Compliance_Score":91,"Open_Risk_Items":7,"Liability_Exposure":420000,"Outside_Counsel_Spend":76000,"IP_Filings":3,"Claims_Open":3,"Regulatory_Actions":1},
    {"Month":"2026-05","Contracts_Executed":36,"Contract_Cycle_Days":23,"Compliance_Score":94,"Open_Risk_Items":5,"Liability_Exposure":320000,"Outside_Counsel_Spend":64000,"IP_Filings":4,"Claims_Open":2,"Regulatory_Actions":0},
    {"Month":"2026-06","Contracts_Executed":42,"Contract_Cycle_Days":19,"Compliance_Score":96,"Open_Risk_Items":3,"Liability_Exposure":250000,"Outside_Counsel_Spend":58000,"IP_Filings":6,"Claims_Open":1,"Regulatory_Actions":0},
    {"Month":"2026-07","Contracts_Executed":47,"Contract_Cycle_Days":17,"Compliance_Score":97,"Open_Risk_Items":3,"Liability_Exposure":210000,"Outside_Counsel_Spend":52000,"IP_Filings":6,"Claims_Open":1,"Regulatory_Actions":0},
    {"Month":"2026-08","Contracts_Executed":51,"Contract_Cycle_Days":15,"Compliance_Score":98,"Open_Risk_Items":2,"Liability_Exposure":170000,"Outside_Counsel_Spend":49000,"IP_Filings":7,"Claims_Open":1,"Regulatory_Actions":0},
    {"Month":"2026-09","Contracts_Executed":56,"Contract_Cycle_Days":13,"Compliance_Score":99,"Open_Risk_Items":1,"Liability_Exposure":130000,"Outside_Counsel_Spend":45000,"IP_Filings":8,"Claims_Open":0,"Regulatory_Actions":0}
  ]'::jsonb
),
(
  'rd',
  'Research & Development / Innovation',
  'rd_q2_q3_demo.csv',
  '["Month","R&D_Spend","Budget_Allocated","Patent_Filings","Experiments_Run","Milestone_Hit_Rate","TRL_Score","Time_to_Prototype_Days","Researchers_Count","Commercialization_Value"]'::jsonb,
  '[
    {"Month":"2026-04","R&D_Spend":380000,"Budget_Allocated":500000,"Patent_Filings":2,"Experiments_Run":26,"Milestone_Hit_Rate":72,"TRL_Score":5,"Time_to_Prototype_Days":34,"Researchers_Count":24,"Commercialization_Value":1050000},
    {"Month":"2026-05","R&D_Spend":405000,"Budget_Allocated":500000,"Patent_Filings":3,"Experiments_Run":31,"Milestone_Hit_Rate":79,"TRL_Score":5,"Time_to_Prototype_Days":27,"Researchers_Count":26,"Commercialization_Value":1380000},
    {"Month":"2026-06","R&D_Spend":420000,"Budget_Allocated":500000,"Patent_Filings":4,"Experiments_Run":38,"Milestone_Hit_Rate":86,"TRL_Score":6,"Time_to_Prototype_Days":21,"Researchers_Count":28,"Commercialization_Value":1800000},
    {"Month":"2026-07","R&D_Spend":438000,"Budget_Allocated":520000,"Patent_Filings":4,"Experiments_Run":43,"Milestone_Hit_Rate":88,"TRL_Score":6,"Time_to_Prototype_Days":19,"Researchers_Count":30,"Commercialization_Value":2140000},
    {"Month":"2026-08","R&D_Spend":461000,"Budget_Allocated":540000,"Patent_Filings":5,"Experiments_Run":49,"Milestone_Hit_Rate":91,"TRL_Score":7,"Time_to_Prototype_Days":16,"Researchers_Count":32,"Commercialization_Value":2600000},
    {"Month":"2026-09","R&D_Spend":488000,"Budget_Allocated":560000,"Patent_Filings":6,"Experiments_Run":56,"Milestone_Hit_Rate":94,"TRL_Score":7,"Time_to_Prototype_Days":14,"Researchers_Count":35,"Commercialization_Value":3180000}
  ]'::jsonb
),
(
  'strategy',
  'Corporate Strategy & Biz Dev',
  'strategy_q2_q3_demo.csv',
  '["Month","Strategic_Pipeline_Value","TAM_Coverage","Market_Share","Synergy_Score","Diligence_Risk_Score","Partnership_Revenue","Competitive_Win_Rate","Strategic_Initiatives_OnTrack","M&A_Targets"]'::jsonb,
  '[
    {"Month":"2026-04","Strategic_Pipeline_Value":32000000,"TAM_Coverage":14.5,"Market_Share":5.1,"Synergy_Score":7.4,"Diligence_Risk_Score":3.6,"Partnership_Revenue":760000,"Competitive_Win_Rate":56,"Strategic_Initiatives_OnTrack":68,"M&A_Targets":2},
    {"Month":"2026-05","Strategic_Pipeline_Value":38500000,"TAM_Coverage":16.2,"Market_Share":5.7,"Synergy_Score":8.3,"Diligence_Risk_Score":2.9,"Partnership_Revenue":960000,"Competitive_Win_Rate":60,"Strategic_Initiatives_OnTrack":75,"M&A_Targets":3},
    {"Month":"2026-06","Strategic_Pipeline_Value":45000000,"TAM_Coverage":18.4,"Market_Share":6.2,"Synergy_Score":9.2,"Diligence_Risk_Score":2.4,"Partnership_Revenue":1200000,"Competitive_Win_Rate":64,"Strategic_Initiatives_OnTrack":82,"M&A_Targets":3},
    {"Month":"2026-07","Strategic_Pipeline_Value":51000000,"TAM_Coverage":20.1,"Market_Share":6.8,"Synergy_Score":9.4,"Diligence_Risk_Score":2.2,"Partnership_Revenue":1420000,"Competitive_Win_Rate":67,"Strategic_Initiatives_OnTrack":86,"M&A_Targets":4},
    {"Month":"2026-08","Strategic_Pipeline_Value":58500000,"TAM_Coverage":22.6,"Market_Share":7.4,"Synergy_Score":9.6,"Diligence_Risk_Score":2.0,"Partnership_Revenue":1710000,"Competitive_Win_Rate":70,"Strategic_Initiatives_OnTrack":89,"M&A_Targets":4},
    {"Month":"2026-09","Strategic_Pipeline_Value":67000000,"TAM_Coverage":25.3,"Market_Share":8.1,"Synergy_Score":9.8,"Diligence_Risk_Score":1.8,"Partnership_Revenue":2080000,"Competitive_Win_Rate":74,"Strategic_Initiatives_OnTrack":93,"M&A_Targets":5}
  ]'::jsonb
);

insert into public.department_snapshots (
  department_id,
  department_name,
  filename,
  uploaded_at,
  headers,
  record_count,
  sample_records,
  records,
  content
)
select
  department_id,
  department_name,
  filename,
  '2026-09-30T18:00:00Z'::timestamptz,
  headers,
  jsonb_array_length(records),
  (
    select coalesce(jsonb_agg(value), '[]'::jsonb)
    from (
      select value
      from jsonb_array_elements(records) with ordinality as item(value, ord)
      order by ord
      limit 5
    ) sample_rows
  ),
  records,
  jsonb_build_object(
    'departmentId', department_id,
    'departmentName', department_name,
    'filename', filename,
    'uploadedAt', '2026-09-30T18:00:00Z',
    'headers', headers,
    'recordCount', jsonb_array_length(records),
    'records', records,
    'sampleRecords', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(records) with ordinality as item(value, ord)
        order by ord
        limit 5
      ) sample_rows
    )
  )
from demo_department_seed;

insert into public.department_snapshot_history (
  department_id,
  department_name,
  import_type,
  filename,
  imported_at,
  period_start,
  period_end,
  headers,
  record_count,
  sample_records,
  records,
  content
)
select
  seed.department_id,
  seed.department_name,
  'demo-q2-import',
  replace(seed.filename, 'q2_q3', 'q2'),
  '2026-06-30T18:00:00Z'::timestamptz,
  '2026-04',
  '2026-06',
  seed.headers,
  3,
  q2.records,
  q2.records,
  jsonb_build_object(
    'departmentId', seed.department_id,
    'departmentName', seed.department_name,
    'importType', 'demo-q2-import',
    'filename', replace(seed.filename, 'q2_q3', 'q2'),
    'uploadedAt', '2026-06-30T18:00:00Z',
    'periodStart', '2026-04',
    'periodEnd', '2026-06',
    'headers', seed.headers,
    'recordCount', 3,
    'records', q2.records,
    'sampleRecords', q2.records
  )
from demo_department_seed seed
cross join lateral (
  select jsonb_agg(value order by ord) as records
  from jsonb_array_elements(seed.records) with ordinality as item(value, ord)
  where ord <= 3
) q2
union all
select
  seed.department_id,
  seed.department_name,
  'demo-q3-import',
  replace(seed.filename, 'q2_q3', 'q3'),
  '2026-09-30T18:00:00Z'::timestamptz,
  '2026-07',
  '2026-09',
  seed.headers,
  3,
  q3.records,
  q3.records,
  jsonb_build_object(
    'departmentId', seed.department_id,
    'departmentName', seed.department_name,
    'importType', 'demo-q3-import',
    'filename', replace(seed.filename, 'q2_q3', 'q3'),
    'uploadedAt', '2026-09-30T18:00:00Z',
    'periodStart', '2026-07',
    'periodEnd', '2026-09',
    'headers', seed.headers,
    'recordCount', 3,
    'records', q3.records,
    'sampleRecords', q3.records
  )
from demo_department_seed seed
cross join lateral (
  select jsonb_agg(value order by ord) as records
  from jsonb_array_elements(seed.records) with ordinality as item(value, ord)
  where ord > 3
) q3;

with department_rows as (
  select
    department_id,
    department_name,
    filename,
    uploaded_at,
    headers,
    record_count,
    sample_records,
    records,
    content
  from public.department_snapshots
),
summary as (
  select
    jsonb_object_agg(department_id, content order by department_name) as departments,
    jsonb_agg(
      jsonb_build_object(
        'departmentId', department_id,
        'departmentName', department_name,
        'filename', filename,
        'uploadedAt', uploaded_at,
        'headers', headers,
        'recordCount', record_count,
        'sampleRecords', sample_records
      )
      order by department_name
    ) as department_summaries,
    count(*) as total_departments,
    sum(record_count) as total_records
  from department_rows
)
insert into public.organization_summaries (
  id,
  updated_at,
  total_departments,
  total_records,
  department_summaries,
  departments,
  content
)
select
  'current',
  '2026-09-30T18:00:00Z'::timestamptz,
  total_departments,
  total_records,
  department_summaries,
  departments,
  jsonb_build_object(
    'updatedAt', '2026-09-30T18:00:00Z',
    'totalDepartments', total_departments,
    'totalRecords', total_records,
    'departments', departments,
    'departmentSummaries', department_summaries,
    'integrations', jsonb_build_object(
      'slack', jsonb_build_object('connected', true, 'name', 'Slack', 'icon', '💬', 'team_name', 'AICoS Demo HQ', 'team_id', 'TDEMO001', 'bot_user_id', 'UDEMOAIC'),
      'gmail', jsonb_build_object('connected', false, 'name', 'Gmail & Calendar', 'icon', '📧'),
      'notion', jsonb_build_object('connected', true, 'name', 'Notion OKRs', 'icon', '📓', 'database_id', 'demo-notion-okr-db', 'database_title', 'Product OKRs'),
      'hubspot', jsonb_build_object('connected', true, 'name', 'HubSpot Deals', 'icon', '🧲', 'portal_id', 'demo-portal-2048', 'hasToken', true),
      'linear', jsonb_build_object('connected', true, 'name', 'Linear Tickets', 'icon', '🎫', 'organization_id', 'demo-linear-org', 'organization_name', 'AICoS Engineering', 'user_email', 'demo-ceo@example.com', 'hasToken', true),
      'clickup', jsonb_build_object('connected', true, 'name', 'ClickUp Workspace', 'icon', '☑️', 'workspace_id', 'demo-clickup-workspace', 'workspace_name', 'AICoS Demo Workspace', 'user_name', 'Demo CEO', 'hasToken', true),
      'jira', jsonb_build_object('connected', true, 'name', 'Jira Issues', 'icon', '🔷', 'site_url', 'https://aicos-demo.atlassian.net', 'email', 'demo-ceo@example.com', 'jql', 'project in (PLAT, GTM, DATA) order by updated DESC', 'user_name', 'Demo CEO', 'hasToken', true),
      'confluence', jsonb_build_object('connected', true, 'name', 'Confluence Knowledge', 'icon', '📘', 'site_url', 'https://aicos-demo.atlassian.net', 'email', 'demo-ceo@example.com', 'cql', 'type=page order by lastmodified desc', 'user_name', 'Demo CEO', 'hasToken', true)
    ),
    'todoStore', jsonb_build_object(
      'updatedAt', '2026-09-30T18:00:00Z',
      'items', jsonb_build_array(
        jsonb_build_object('id', 'todo-demo-1', 'title', 'Approve enterprise pricing guardrails before Q4 pipeline push', 'owner', 'CEO', 'status', 'open', 'priority', 'P0', 'source', 'board-memo'),
        jsonb_build_object('id', 'todo-demo-2', 'title', 'Resolve onboarding activation gap for strategic accounts', 'owner', 'Product', 'status', 'open', 'priority', 'P1', 'source', 'notion'),
        jsonb_build_object('id', 'todo-demo-3', 'title', 'Close SOC2 evidence requests for healthcare vertical expansion', 'owner', 'Legal/IT', 'status', 'waiting', 'priority', 'P1', 'source', 'slack')
      )
    )
  )
from summary
on conflict (id) do update set
  updated_at = excluded.updated_at,
  total_departments = excluded.total_departments,
  total_records = excluded.total_records,
  department_summaries = excluded.department_summaries,
  departments = excluded.departments,
  content = excluded.content;

insert into public.board_memos (memo_type, title, department_id, department_name, generated_at, created_by, website, content)
values
(
  'board-memo',
  'Q2 to Q3 Operating Inflection Board Memo',
  'executive',
  'Executive / Office of the CEO',
  '2026-09-30T19:00:00Z',
  'Demo User',
  'https://example.com',
  jsonb_build_object(
    'executiveSummary', 'Q3 acceleration is visible across ARR, Rule of 40, pipeline efficiency, retention, and operating risk. The CEO should preserve spend discipline while pushing enterprise expansion.',
    'recommendation', 'Increase GTM capacity behind highest-converting verticals, maintain burn multiple below 1.2x, and keep enterprise risk score below 2.0.',
    'risks', 'Customer onboarding load and security evidence requests remain the main Q4 execution bottlenecks.',
    'actions', 'Approve pricing guardrails, assign product owners to activation gaps, and review SOC2 evidence weekly.'
  )
),
(
  'board-memo',
  'Product And GTM Execution Memo',
  'product',
  'Product Management & Development',
  '2026-09-15T16:00:00Z',
  'Demo User',
  'https://example.com',
  jsonb_build_object(
    'executiveSummary', 'Product adoption and ARR influenced improved materially from Q2 to Q3 while P1 defects fell.',
    'recommendation', 'Continue shipping onboarding and enterprise admin workflows while protecting cycle time under 10 days.',
    'risks', 'Feature adoption is improving but still trails sales demand for enterprise plans.',
    'actions', 'Prioritize admin controls, lifecycle messaging, and roadmap communication in Confluence.'
  )
);

insert into public.slack_installations (team_id, team_name, app_id, bot_user_id, bot_access_token, scope, authed_user_id, is_active, installed_at, content)
values (
  'TDEMO001',
  'AICoS Demo HQ',
  'ADEMOAICOS',
  'UDEMOAIC',
  'xoxb-demo-token-not-valid',
  'channels:read,channels:history,chat:write,users:read,app_mentions:read',
  'UDEMOCEO',
  true,
  '2026-04-01T09:00:00Z',
  jsonb_build_object('demo', true, 'note', 'Fake token for UI demo only.')
);

insert into public.slack_events (team_id, event_id, event_type, channel_id, user_id, event_ts, text, handled, content)
values
('TDEMO001', 'EvDEMO001', 'message', 'CEXEC', 'UFINANCE', '1780300800.000100', 'Q3 forecast improved. Need CEO approval on enterprise discount guardrails by Friday.', true, jsonb_build_object('priority', 'P0', 'department', 'sales')),
('TDEMO001', 'EvDEMO002', 'app_mention', 'CPRODUCT', 'UPRODUCT', '1780387200.000200', '@AICoS summarize activation blockers for strategic accounts.', true, jsonb_build_object('priority', 'P1', 'department', 'product')),
('TDEMO001', 'EvDEMO003', 'message', 'CSECURITY', 'UIT', '1780473600.000300', 'SOC2 evidence package needs Legal review before healthcare launch.', true, jsonb_build_object('priority', 'P1', 'department', 'it'));

insert into public.slack_message_snapshots (team_id, channel_id, channel_name, message_ts, user_id, text, content, captured_at)
values
('TDEMO001', 'CEXEC', 'exec-ops', '1780300800.000100', 'UFINANCE', 'Q3 forecast improved. Need CEO approval on enterprise discount guardrails by Friday.', jsonb_build_object('sentiment', 'urgent', 'commitment', true), '2026-09-30T15:00:00Z'),
('TDEMO001', 'CPRODUCT', 'product-leadership', '1780387200.000200', 'UPRODUCT', 'Activation gap narrowed, but enterprise admins still need workflow templates.', jsonb_build_object('sentiment', 'focused', 'commitment', true), '2026-09-30T15:05:00Z'),
('TDEMO001', 'CSECURITY', 'security-compliance', '1780473600.000300', 'UIT', 'SOC2 evidence package is 82 percent complete with legal signoff pending.', jsonb_build_object('sentiment', 'watch', 'commitment', true), '2026-09-30T15:10:00Z');

insert into public.notion_okr_snapshots (database_id, synced_at, okrs, summary, content)
values (
  'demo-notion-okr-db',
  '2026-09-30T18:05:00Z',
  '[
    {"id":"okr-1","objective":"Improve enterprise activation","keyResult":"Raise activation rate to 49%","owner":"Product","status":"On Track","progress":91,"quarter":"Q3 2026","dueDate":"2026-09-30","priority":"P0","confidence":0.86},
    {"id":"okr-2","objective":"Increase expansion readiness","keyResult":"Ship admin workflow templates","owner":"Product","status":"At Risk","progress":72,"quarter":"Q3 2026","dueDate":"2026-09-20","priority":"P1","confidence":0.64},
    {"id":"okr-3","objective":"Protect platform quality","keyResult":"Reduce P1 bugs below 2","owner":"Engineering","status":"Complete","progress":100,"quarter":"Q3 2026","dueDate":"2026-09-15","priority":"P0","confidence":0.93},
    {"id":"okr-4","objective":"Create Q4 product narrative","keyResult":"Publish roadmap and launch plan","owner":"Product Marketing","status":"On Track","progress":84,"quarter":"Q3 2026","dueDate":"2026-09-28","priority":"P1","confidence":0.81}
  ]'::jsonb,
  '{"total":4,"avgProgress":87,"atRisk":1,"completed":1,"owners":3}'::jsonb,
  '{"source":"notion","databaseId":"demo-notion-okr-db","syncedAt":"2026-09-30T18:05:00Z"}'::jsonb
);

insert into public.hubspot_deal_snapshots (portal_id, synced_at, deals, pipelines, owners, summary, content)
values (
  'demo-portal-2048',
  '2026-09-30T18:10:00Z',
  '[
    {"id":"deal-1","name":"Northstar Bank Enterprise","stage":"Contracting","pipeline":"Enterprise","amount":640000,"weightedAmount":512000,"probability":0.8,"closeDate":"2026-10-15","owner":"Ava Chen","isOpen":true,"isStale":false},
    {"id":"deal-2","name":"Helio Health Expansion","stage":"Security Review","pipeline":"Enterprise","amount":420000,"weightedAmount":252000,"probability":0.6,"closeDate":"2026-10-30","owner":"Marco Silva","isOpen":true,"isStale":true},
    {"id":"deal-3","name":"Zest Foods Multi-Region","stage":"Proposal","pipeline":"Commercial","amount":180000,"weightedAmount":90000,"probability":0.5,"closeDate":"2026-11-12","owner":"Priya Rao","isOpen":true,"isStale":false},
    {"id":"deal-4","name":"Acme Logistics Renewal","stage":"Closed Won","pipeline":"Commercial","amount":220000,"weightedAmount":220000,"probability":1,"closeDate":"2026-09-20","owner":"Ava Chen","isOpen":false,"isStale":false}
  ]'::jsonb,
  '[{"id":"enterprise","name":"Enterprise"},{"id":"commercial","name":"Commercial"}]'::jsonb,
  '[{"id":"owner-1","name":"Ava Chen"},{"id":"owner-2","name":"Marco Silva"},{"id":"owner-3","name":"Priya Rao"}]'::jsonb,
  '{"totalDeals":4,"openDeals":3,"openPipelineAmount":1240000,"weightedPipelineAmount":854000,"closedWonAmount":220000,"staleDeals":1,"forecastNext90Days":854000,"avgDealSize":310000,"winRate":33,"stageBreakdown":[{"name":"Contracting","count":1},{"name":"Security Review","count":1},{"name":"Proposal","count":1}],"pipelineBreakdown":[{"name":"Enterprise","count":2},{"name":"Commercial","count":1}],"topOpenDeals":[]}'::jsonb,
  '{"source":"hubspot","portalId":"demo-portal-2048","syncedAt":"2026-09-30T18:10:00Z"}'::jsonb
);

insert into public.linear_ticket_snapshots (organization_id, organization_name, synced_at, issues, summary, content)
values (
  'demo-linear-org',
  'AICoS Engineering',
  '2026-09-30T18:15:00Z',
  '[
    {"id":"lin-1","identifier":"ENG-142","title":"Enterprise admin templates","team":"Product Engineering","priority":"Urgent","state":"In Progress","assignee":"Nina Patel","isOpen":true,"isOverdue":false,"isStale":false,"ageDays":8},
    {"id":"lin-2","identifier":"ENG-143","title":"SOC2 evidence automation","team":"Platform","priority":"High","state":"Blocked","assignee":"Owen Kim","isOpen":true,"isOverdue":true,"isStale":true,"ageDays":23},
    {"id":"lin-3","identifier":"ENG-144","title":"Revenue cohort chart polish","team":"Data","priority":"Medium","state":"Done","assignee":"Leah Stone","isOpen":false,"isOverdue":false,"isStale":false,"ageDays":5},
    {"id":"lin-4","identifier":"ENG-145","title":"Slack task harvester confidence scoring","team":"AI","priority":"High","state":"In Review","assignee":"Sam Iyer","isOpen":true,"isOverdue":false,"isStale":false,"ageDays":11}
  ]'::jsonb,
  '{"totalIssues":4,"openIssues":3,"urgentIssues":1,"overdueIssues":1,"staleIssues":1,"completedLast30Days":1,"canceledIssues":0,"avgOpenAgeDays":14,"stateBreakdown":[{"name":"In Progress","count":1},{"name":"Blocked","count":1},{"name":"In Review","count":1}],"teamBreakdown":[{"name":"Platform","count":1},{"name":"Product Engineering","count":1},{"name":"AI","count":1}],"priorityBreakdown":[{"name":"High","count":2},{"name":"Urgent","count":1}],"topRisks":[]}'::jsonb,
  '{"source":"linear","organizationName":"AICoS Engineering","syncedAt":"2026-09-30T18:15:00Z"}'::jsonb
);

insert into public.clickup_workspace_snapshots (workspace_id, workspace_name, synced_at, goals, tasks, roadmaps, views, summary, content)
values (
  'demo-clickup-workspace',
  'AICoS Demo Workspace',
  '2026-09-30T18:20:00Z',
  '[
    {"id":"goal-1","name":"Q3 Enterprise Readiness","progress":88,"owners":["CEO","Product"],"dueDate":"2026-09-30","targets":[{"name":"Activation","progress":91},{"name":"SOC2 Evidence","progress":82}]},
    {"id":"goal-2","name":"Q3 GTM Efficiency","progress":93,"owners":["Sales","Marketing"],"dueDate":"2026-09-30","targets":[{"name":"Pipeline","progress":96},{"name":"CAC Payback","progress":90}]}
  ]'::jsonb,
  '[
    {"id":"cu-1","name":"Publish Q4 launch roadmap","status":"In Progress","priority":"high","list":"Roadmap","assignees":["Product"],"dueDate":"2026-09-28","isOpen":true,"isOverdue":true,"isStale":false,"isRoadmap":true},
    {"id":"cu-2","name":"Finalize enterprise discount policy","status":"Review","priority":"urgent","list":"CEO Staff","assignees":["CEO","Finance"],"dueDate":"2026-10-04","isOpen":true,"isOverdue":false,"isStale":false,"isRoadmap":false},
    {"id":"cu-3","name":"Healthcare launch compliance checklist","status":"Blocked","priority":"high","list":"Launch","assignees":["Legal","IT"],"dueDate":"2026-09-25","isOpen":true,"isOverdue":true,"isStale":true,"isRoadmap":true}
  ]'::jsonb,
  '[
    {"id":"cu-1","name":"Publish Q4 launch roadmap","status":"In Progress","priority":"high","list":"Roadmap","assignees":["Product"],"dueDate":"2026-09-28","isOpen":true,"isOverdue":true,"isStale":false,"isRoadmap":true},
    {"id":"cu-3","name":"Healthcare launch compliance checklist","status":"Blocked","priority":"high","list":"Launch","assignees":["Legal","IT"],"dueDate":"2026-09-25","isOpen":true,"isOverdue":true,"isStale":true,"isRoadmap":true}
  ]'::jsonb,
  '[{"id":"view-1","name":"CEO Operating Review","type":"board"},{"id":"view-2","name":"Q4 Roadmap","type":"timeline"}]'::jsonb,
  '{"totalGoals":2,"avgGoalProgress":91,"openTasks":3,"overdueTasks":2,"urgentTasks":1,"staleTasks":1,"completedTasks":0,"roadmapItems":2,"statusBreakdown":[{"name":"In Progress","count":1},{"name":"Review","count":1},{"name":"Blocked","count":1}],"ownerBreakdown":[{"name":"Product","count":1},{"name":"CEO","count":1},{"name":"Legal","count":1}],"roadmapBreakdown":[{"name":"In Progress","count":1},{"name":"Blocked","count":1}],"topRisks":[]}'::jsonb,
  '{"source":"clickup","workspaceName":"AICoS Demo Workspace","syncedAt":"2026-09-30T18:20:00Z"}'::jsonb
);

insert into public.jira_issue_snapshots (site_url, synced_at, issues, projects, summary, content)
values (
  'https://aicos-demo.atlassian.net',
  '2026-09-30T18:25:00Z',
  '[
    {"id":"jira-1","key":"PLAT-241","summary":"SOC2 evidence automation","issueType":"Story","status":"Blocked","priority":"High","projectKey":"PLAT","assignee":"Owen Kim","dueDate":"2026-09-26","isOpen":true,"isOverdue":true,"isStale":true,"isHighPriority":true,"isRoadmap":false,"ageDays":24},
    {"id":"jira-2","key":"GTM-118","summary":"Enterprise pricing approval workflow","issueType":"Epic","status":"In Progress","priority":"Highest","projectKey":"GTM","assignee":"Ava Chen","dueDate":"2026-10-05","isOpen":true,"isOverdue":false,"isStale":false,"isHighPriority":true,"isRoadmap":true,"ageDays":12},
    {"id":"jira-3","key":"DATA-77","summary":"Board memo export data table QA","issueType":"Task","status":"Done","priority":"Medium","projectKey":"DATA","assignee":"Leah Stone","dueDate":"2026-09-20","isOpen":false,"isOverdue":false,"isStale":false,"isHighPriority":false,"isRoadmap":false,"ageDays":6},
    {"id":"jira-4","key":"PLAT-255","summary":"Admin workflow templates","issueType":"Story","status":"Review","priority":"High","projectKey":"PLAT","assignee":"Nina Patel","dueDate":"2026-10-01","isOpen":true,"isOverdue":false,"isStale":false,"isHighPriority":true,"isRoadmap":true,"ageDays":8}
  ]'::jsonb,
  '[{"id":"10001","key":"PLAT","name":"Platform"},{"id":"10002","key":"GTM","name":"Go To Market"},{"id":"10003","key":"DATA","name":"Data Intelligence"}]'::jsonb,
  '{"totalIssues":4,"totalProjects":3,"openIssues":3,"doneIssues":1,"highPriorityIssues":3,"overdueIssues":1,"staleIssues":1,"roadmapIssues":2,"completedLast30Days":1,"avgOpenAgeDays":15,"statusBreakdown":[{"name":"Blocked","count":1},{"name":"In Progress","count":1},{"name":"Review","count":1}],"projectBreakdown":[{"name":"PLAT","count":2},{"name":"GTM","count":1}],"priorityBreakdown":[{"name":"High","count":2},{"name":"Highest","count":1}],"assigneeBreakdown":[{"name":"Owen Kim","count":1},{"name":"Ava Chen","count":1},{"name":"Nina Patel","count":1}],"topRisks":[]}'::jsonb,
  '{"source":"jira","siteUrl":"https://aicos-demo.atlassian.net","syncedAt":"2026-09-30T18:25:00Z"}'::jsonb
);

insert into public.confluence_content_snapshots (site_url, synced_at, pages, spaces, summary, content)
values (
  'https://aicos-demo.atlassian.net',
  '2026-09-30T18:30:00Z',
  '[
    {"id":"conf-1","title":"Q4 Enterprise Launch Roadmap","type":"page","url":"https://aicos-demo.atlassian.net/wiki/spaces/PROD/pages/1","spaceKey":"PROD","spaceName":"Product","owner":"Product","updatedAt":"2026-09-28T10:00:00Z","isRecentlyUpdated":true,"isStale":false,"isRoadmap":true,"isPolicy":false},
    {"id":"conf-2","title":"Enterprise Discount Policy","type":"page","url":"https://aicos-demo.atlassian.net/wiki/spaces/FIN/pages/2","spaceKey":"FIN","spaceName":"Finance","owner":"Finance","updatedAt":"2026-09-22T12:00:00Z","isRecentlyUpdated":true,"isStale":false,"isRoadmap":false,"isPolicy":true},
    {"id":"conf-3","title":"SOC2 Evidence Runbook","type":"page","url":"https://aicos-demo.atlassian.net/wiki/spaces/SEC/pages/3","spaceKey":"SEC","spaceName":"Security","owner":"IT","updatedAt":"2026-08-04T09:00:00Z","isRecentlyUpdated":false,"isStale":false,"isRoadmap":false,"isPolicy":true},
    {"id":"conf-4","title":"Legacy Onboarding Notes","type":"page","url":"https://aicos-demo.atlassian.net/wiki/spaces/CS/pages/4","spaceKey":"CS","spaceName":"Customer Success","owner":"Support","updatedAt":"2026-03-15T09:00:00Z","isRecentlyUpdated":false,"isStale":true,"isRoadmap":false,"isPolicy":false}
  ]'::jsonb,
  '[{"id":"space-1","key":"PROD","name":"Product","type":"global"},{"id":"space-2","key":"FIN","name":"Finance","type":"global"},{"id":"space-3","key":"SEC","name":"Security","type":"global"},{"id":"space-4","key":"CS","name":"Customer Success","type":"global"}]'::jsonb,
  '{"totalPages":4,"totalSpaces":4,"recentlyUpdated":2,"stalePages":1,"roadmapPages":1,"policyPages":2,"knowledgeOwners":4,"spaceBreakdown":[{"name":"PROD","count":1},{"name":"FIN","count":1},{"name":"SEC","count":1},{"name":"CS","count":1}],"ownerBreakdown":[{"name":"Product","count":1},{"name":"Finance","count":1},{"name":"IT","count":1},{"name":"Support","count":1}],"typeBreakdown":[{"name":"page","count":4}],"topPages":[]}'::jsonb,
  '{"source":"confluence","siteUrl":"https://aicos-demo.atlassian.net","syncedAt":"2026-09-30T18:30:00Z"}'::jsonb
);

insert into public.department_embeddings (
  department_id,
  department_name,
  source_type,
  source_id,
  chunk_index,
  content,
  metadata,
  embedding
)
values
(
  'executive',
  'Executive / Office of the CEO',
  'demo_seed',
  'executive-q2-q3',
  0,
  'Q2 to Q3 executive summary: ARR grew from 7.6M to 10.15M, Rule of 40 improved from 29 to 53, and enterprise risk fell from 3.1 to 1.8.',
  '{"departmentId":"executive","periodStart":"2026-04","periodEnd":"2026-09","demo":true}'::jsonb,
  ('[' || array_to_string(array_fill(0.001::float8, array[1536]), ',') || ']')::vector
),
(
  'sales',
  'Sales & Revenue Distribution',
  'demo_seed',
  'sales-q2-q3',
  0,
  'Sales summary: qualified pipeline rose to 1.99M in September, bookings reached 1.32M, and win rate improved to 34 percent.',
  '{"departmentId":"sales","periodStart":"2026-04","periodEnd":"2026-09","demo":true}'::jsonb,
  ('[' || array_to_string(array_fill(0.002::float8, array[1536]), ',') || ']')::vector
),
(
  'product',
  'Product Management & Development',
  'demo_seed',
  'product-q2-q3',
  0,
  'Product summary: active users increased to 231k, retention reached 78 percent, feature adoption reached 54 percent, and P1 bugs dropped to one.',
  '{"departmentId":"product","periodStart":"2026-04","periodEnd":"2026-09","demo":true}'::jsonb,
  ('[' || array_to_string(array_fill(0.003::float8, array[1536]), ',') || ']')::vector
),
(
  'risk',
  'Risk Management & Internal Audit',
  'demo_seed',
  'risk-q2-q3',
  0,
  'Risk summary: enterprise risk improved from 3.1 to 1.8, control coverage rose to 97 percent, and open audit items fell to one.',
  '{"departmentId":"risk","periodStart":"2026-04","periodEnd":"2026-09","demo":true}'::jsonb,
  ('[' || array_to_string(array_fill(0.004::float8, array[1536]), ',') || ']')::vector
);

commit;
