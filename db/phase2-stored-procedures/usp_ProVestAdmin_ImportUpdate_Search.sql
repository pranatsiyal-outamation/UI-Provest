CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ImportUpdate_Search]
    @Search   NVARCHAR(200) = NULL,
    @id INT = NULL,
    @client_id INT = NULL,
    @SortBy   VARCHAR(50)   = 'id',
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
    IF @SortBy NOT IN ('id','client_id','lawfirm_filenumber','plaintiff') SET @SortBy = 'id';

    DECLARE @Term NVARCHAR(210) = NULL;
    IF @Search IS NOT NULL AND LTRIM(RTRIM(@Search)) <> ''
        SET @Term = '%' + REPLACE(REPLACE(REPLACE(@Search,'\','\\'),'%','\%'),'_','\_') + '%';

    -- Uniqueness of [id] is a property of the WHOLE table, not of the filtered
    -- page. Computing it with a window function over the filtered set would
    -- report a duplicated id as addressable whenever a filter happened to
    -- isolate one of its rows, so the duplicates are collected up front.
    DECLARE @DupIds TABLE (id INT PRIMARY KEY);
    INSERT INTO @DupIds (id)
    SELECT id FROM dbo.Import_Update WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1;

    SELECT
        iu.[id],
        iu.[client_id],
        iu.[lawfirm_filenumber],
        iu.[plaintiff],
        iu.[defendant],
        iu.[document_type],
        iu.[index_number],
        iu.[court_name],
        iu.[servee_name],
        iu.[client_ref],
        iu.[creditor],
        CAST(CASE WHEN iu.id IS NULL THEN 0
                  WHEN EXISTS (SELECT 1 FROM @DupIds d WHERE d.id = iu.id) THEN 0
                  ELSE 1 END AS BIT) AS IsAddressable,
        COUNT(*) OVER () AS TotalCount
    FROM dbo.Import_Update iu
    WHERE (@id IS NULL OR iu.[id] = @id)
      AND (@client_id IS NULL OR iu.[client_id] = @client_id)
      AND (@Term IS NULL OR
             iu.[lawfirm_filenumber] LIKE @Term ESCAPE '\'
          OR iu.[plaintiff] LIKE @Term ESCAPE '\'
          OR iu.[defendant] LIKE @Term ESCAPE '\'
          OR iu.[document_type] LIKE @Term ESCAPE '\'
          OR iu.[index_number] LIKE @Term ESCAPE '\'
          OR iu.[court_name] LIKE @Term ESCAPE '\'
          OR iu.[servee_name] LIKE @Term ESCAPE '\'
          OR iu.[client_ref] LIKE @Term ESCAPE '\'
          OR iu.[creditor] LIKE @Term ESCAPE '\'
          )
    ORDER BY
        CASE WHEN @SortDir='ASC'  AND @SortBy='id' THEN iu.[id] END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='id' THEN iu.[id] END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='client_id' THEN iu.[client_id] END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='client_id' THEN iu.[client_id] END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='lawfirm_filenumber' THEN iu.[lawfirm_filenumber] END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='lawfirm_filenumber' THEN iu.[lawfirm_filenumber] END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='plaintiff' THEN iu.[plaintiff] END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='plaintiff' THEN iu.[plaintiff] END DESC,
        -- No PK exists on this table, so a fully deterministic order is not
        -- achievable. This composite tiebreaker makes paging stable for every
        -- row except exact duplicates, which are flagged IsAddressable = 0.
        iu.[id] ASC, iu.[client_id] ASC, iu.[lawfirm_filenumber] ASC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
