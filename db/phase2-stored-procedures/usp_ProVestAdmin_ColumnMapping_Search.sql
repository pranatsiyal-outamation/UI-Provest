CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ColumnMapping_Search]
    @Search                  NVARCHAR(200) = NULL,
    @ImporterId              INT           = NULL,
    @ProVestStandardColumnId INT           = NULL,
    @SortBy                  VARCHAR(50)   = 'ImporterId',
    @SortDir                 VARCHAR(4)    = 'ASC',
    @Page                    INT           = 1,
    @PageSize                INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
    IF @PageSize > 100 SET @PageSize = 100;
    IF @SortDir NOT IN ('ASC','DESC') SET @SortDir = 'ASC';
    IF @SortBy NOT IN ('Id','ImporterId','ColumnName','StandardColumnName')
        SET @SortBy = 'ImporterId';

    DECLARE @Term NVARCHAR(210) = NULL;
    IF @Search IS NOT NULL AND LTRIM(RTRIM(@Search)) <> ''
        SET @Term = '%' + REPLACE(REPLACE(REPLACE(@Search,'\','\\'),'%','\%'),'_','\_') + '%';

    -- ImporterId is Import_Update.id. This table is generated from Import_Update by
    -- usp_ProVestAdmin_ColumnMapping_RegenerateForImporter, hence read-only in the admin tool.
    SELECT
        m.Id,
        m.ImporterId,
        m.ColumnName,
        m.ProVestStandardColumnId,
        sc.ColumnName AS StandardColumnName,
        COUNT(*) OVER () AS TotalCount
    FROM dbo.ProVestColumnMapping m
    INNER JOIN dbo.ProVestStandardColumn sc ON sc.Id = m.ProVestStandardColumnId
    WHERE (@ImporterId              IS NULL OR m.ImporterId              = @ImporterId)
      AND (@ProVestStandardColumnId IS NULL OR m.ProVestStandardColumnId = @ProVestStandardColumnId)
      AND (@Term IS NULL OR
              m.ColumnName  LIKE @Term ESCAPE '\'
           OR sc.ColumnName LIKE @Term ESCAPE '\')
    ORDER BY
        CASE WHEN @SortDir='ASC'  AND @SortBy='ImporterId'         THEN m.ImporterId  END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ImporterId'         THEN m.ImporterId  END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='ColumnName'         THEN m.ColumnName  END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ColumnName'         THEN m.ColumnName  END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='StandardColumnName' THEN sc.ColumnName END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='StandardColumnName' THEN sc.ColumnName END DESC,
        CASE WHEN @SortDir='DESC' AND @SortBy='Id'                 THEN m.Id          END DESC,
        m.Id ASC                                  -- default + deterministic tiebreaker
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
