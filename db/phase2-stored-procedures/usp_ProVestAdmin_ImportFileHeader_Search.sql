CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ImportFileHeader_Search]
    @Search   NVARCHAR(200) = NULL,
    @id INT = NULL,
    @client_id INT = NULL,
    @importer_id INT = NULL,
    @SortBy   VARCHAR(50)   = 'client_id',
    @SortDir  VARCHAR(4)    = 'ASC',
    @Page     INT           = 1,
    @PageSize INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
    IF @PageSize > 100 SET @PageSize = 100;
    IF @SortDir NOT IN ('ASC','DESC') SET @SortDir = 'ASC';
    IF @SortBy NOT IN ('id','client_id','importer_id') SET @SortBy = 'client_id';

    DECLARE @Term NVARCHAR(210) = NULL;
    IF @Search IS NOT NULL AND LTRIM(RTRIM(@Search)) <> ''
        SET @Term = '%' + REPLACE(REPLACE(REPLACE(@Search,'\','\\'),'%','\%'),'_','\_') + '%';

    -- Uniqueness of [id] is a property of the WHOLE table, not of the filtered
    -- page. Computing it with a window function over the filtered set would
    -- report a duplicated id as addressable whenever a filter happened to
    -- isolate one of its rows, so the duplicates are collected up front.
    DECLARE @DupIds TABLE (id INT PRIMARY KEY);
    INSERT INTO @DupIds (id)
    SELECT id FROM dbo.ImportFileHeader WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1;

    SELECT
        h.[id],
        h.[client_id],
        h.[importer_id],
        h.[col_1],
        h.[col_2],
        h.[col_3],
        h.[col_4],
        h.[col_5],
        h.[col_6],
        h.[col_7],
        h.[col_8],
        LEFT(h.[unique_key], 200) AS unique_key_preview,
        CAST(CASE WHEN h.id IS NULL THEN 0
                  WHEN EXISTS (SELECT 1 FROM @DupIds d WHERE d.id = h.id) THEN 0
                  ELSE 1 END AS BIT) AS IsAddressable,
        COUNT(*) OVER () AS TotalCount
    FROM dbo.ImportFileHeader h
    WHERE (@id IS NULL OR h.[id] = @id)
      AND (@client_id IS NULL OR h.[client_id] = @client_id)
      AND (@importer_id IS NULL OR h.[importer_id] = @importer_id)
      AND (@Term IS NULL OR
             h.[unique_key] LIKE @Term ESCAPE '\'
          )
    ORDER BY
        CASE WHEN @SortDir='ASC'  AND @SortBy='id' THEN h.[id] END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='id' THEN h.[id] END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='client_id' THEN h.[client_id] END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='client_id' THEN h.[client_id] END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='importer_id' THEN h.[importer_id] END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='importer_id' THEN h.[importer_id] END DESC,
        -- No PK exists on this table, so a fully deterministic order is not
        -- achievable. This composite tiebreaker makes paging stable for every
        -- row except exact duplicates, which are flagged IsAddressable = 0.
        h.[id] ASC, h.[client_id] ASC, h.[importer_id] ASC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
