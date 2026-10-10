"""Normalize original NPA main-form CSV with an explicit, year-reviewed column definition.
Never guess column indices or repair corrupted headers. Writes a new UTF-8 CSV only.
"""
import argparse
import csv
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

def coordinate(value, kind):
    if kind=='decimal': result=float(value)
    elif kind=='dms':
        n=int(value);degrees=n//10000000;minutes=n//100000%100;seconds=n%100000/1000
        if n<0 or minutes>=60 or seconds>=60: raise ValueError('Invalid DMS coordinate')
        result=degrees+minutes/60+seconds/3600
    else:raise ValueError('Explicit coordinate format required')
    if not math.isfinite(result):raise ValueError('Invalid coordinate')
    return result

def normalize(args):
    definition=json.loads(Path(args.definition).read_text(encoding='utf-8'))
    fields=['source_year','source_prefecture_code','prefecture_code','police_station_code','record_number','municipality_code','latitude','longitude','occurred_at','party_a_type_code','party_b_type_code','fatalities','accident_type_code']
    required=['record_type','prefecture','station','number','municipality','latitude','longitude','year','month','day','hour','minute','party_a','party_b','fatalities','accident_class']
    if set(required)-set(definition['columns']):raise ValueError('Incomplete source definition')
    count=ignored=0
    with open(args.input,encoding=args.encoding,newline='') as source,open(args.output,'x',encoding='utf-8',newline='') as target:
        reader=csv.DictReader(source);writer=csv.DictWriter(target,fieldnames=fields);writer.writeheader()
        if any('\ufffd' in name for name in (reader.fieldnames or [])) or any(name not in (reader.fieldnames or []) for name in definition['columns'].values()):raise ValueError('Missing or corrupt source headers; obtain original official CSV')
        for raw in reader:
            row={k:raw[v].strip() for k,v in definition['columns'].items()}
            if row['record_type']!='1':ignored+=1;continue
            year=int(row['year'])
            if year!=definition['year']:raise ValueError('Source year differs from definition')
            prefecture=definition['prefectureMap'][row['prefecture']]
            municipality=row['municipality'].zfill(3)
            if definition['municipalityFormat']=='local3':municipality=prefecture+municipality
            elif definition['municipalityFormat']!='full5':raise ValueError('Unknown municipality format')
            stamp=datetime(year,int(row['month']),int(row['day']),int(row['hour']),int(row['minute']),tzinfo=timezone(timedelta(hours=9)))
            result=dict(zip(fields,[year,row['prefecture'],prefecture,row['station'],row['number'],municipality,coordinate(row['latitude'],definition['coordinateFormat']),coordinate(row['longitude'],definition['coordinateFormat']),stamp.isoformat(),row['party_a'].zfill(2) if row['party_a'] else '',row['party_b'].zfill(2) if row['party_b'] else '',int(row['fatalities']),row['accident_class'].zfill(2)]))
            if len(municipality)!=5:raise ValueError('Invalid municipality code')
            writer.writerow(result);count+=1
    print(json.dumps({'normalizedRecords':count,'ignoredNonMainForms':ignored}))
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ['input','output','definition']:parser.add_argument('--'+name,required=True)
    parser.add_argument('--encoding',default='cp932')
    normalize(parser.parse_args())
