%Analyse the DemandLog

PosixTimeData = readmatrix('V:\DemandLogRecirc.txt','Delimiter',',');

DataTimeData = datetime(PosixTimeData,'ConvertFrom','posixtime','TimeZone','UTC');

histogram(mod(DataTimeData.Hour + 16,24) + DataTimeData.Minute/60)
