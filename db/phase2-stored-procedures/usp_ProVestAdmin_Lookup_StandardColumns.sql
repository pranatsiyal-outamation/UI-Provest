-- Dropdown source for ProVestColumnMapping.ProVestStandardColumnId.
-- Small, unpaged.
CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_Lookup_StandardColumns]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        sc.Id,
        sc.ColumnName,
        sc.DataType,
        sc.SequenceNo
    FROM dbo.ProVestStandardColumn sc
    ORDER BY
        CASE WHEN sc.SequenceNo IS NULL THEN 1 ELSE 0 END,
        sc.SequenceNo,
        sc.ColumnName;
END
